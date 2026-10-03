import cors from 'cors';
import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import morgan from 'morgan';
import { Kind, parse } from 'graphql';
import { schema } from './graphql/schema.js';
import { authenticateRequest } from './services/auth.js';
import { errorFormatter, httpStatusForCode } from './services/errors.js';
import type { IncomingMessage } from 'node:http';
import { publicReceiptSnapshot, receiptHtmlEscape, receiptRows } from './services/receiptLinks.js';
import { renderReceiptPng } from './services/receiptImage.js';

export function receiptLinkManagementOnly(body: unknown): boolean {
  if (!body || typeof body !== 'object' || !('query' in body) || typeof body.query !== 'string') return false;
  try {
    const document = parse(body.query);
    const operations = document.definitions.filter(definition => definition.kind === Kind.OPERATION_DEFINITION);
    if (operations.length !== 1) return false;
    const selections = operations[0].selectionSet.selections;
    return selections.length === 1 && selections[0].kind === Kind.FIELD && (
      (operations[0].operation === 'mutation' && selections[0].name.value === 'revokeReceiptLink') ||
      (operations[0].operation === 'query' && selections[0].name.value === 'receiptLinks')
    );
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY || false);
  const receiptRequests = new Map<string, { count: number; expiresAt: number }>();
  let receiptRequestCount = 0;
  const limitPublicReceipt = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let current = receiptRequests.get(key);
    if (!current || current.expiresAt <= now) {
      if (receiptRequests.size >= 10_000) {
        for (const [ip, bucket] of receiptRequests) if (bucket.expiresAt <= now) receiptRequests.delete(ip);
        if (receiptRequests.size >= 10_000) return res.status(429).end();
      }
      current = { count: 0, expiresAt: now + 60_000 };
      receiptRequests.set(key, current);
    }
    current.count++;
    receiptRequestCount++;
    if (current.count > 60) return res.status(429).set('Cache-Control', 'no-store').end();
    if (receiptRequestCount % 1000 === 0) {
      for (const [ip, bucket] of receiptRequests) if (bucket.expiresAt <= now) receiptRequests.delete(ip);
    }
    next();
  };
  const publicReceiptHeaders = (res: express.Response) => {
    res.set({
      'Cache-Control': 'no-store, private, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
  };
  app.use('/comprobante', (req, res, next) => {
    if (!['development', 'test'].includes(process.env.NODE_ENV ?? '') && !req.secure) {
      return res.status(426).set('Cache-Control', 'no-store').end();
    }
    next();
  });
  const missingReceipt = (res: express.Response) => res.status(404).type('text/plain').send('Comprobante no disponible.');
  app.get('/comprobante/:token', limitPublicReceipt, async (req, res, next) => {
    publicReceiptHeaders(res);
    try {
      const token = typeof req.params.token === 'string' ? req.params.token : '';
      const snapshot = await publicReceiptSnapshot(token);
      if (!snapshot) return missingReceipt(res);
      const rows = receiptRows(snapshot).map(([label, value]) =>
        `<dt>${receiptHtmlEscape(label)}</dt><dd>${receiptHtmlEscape(value)}</dd>`
      ).join('');
      const title = `Comprobante ${snapshot.receiptNumber}`;
      return res.type('html').send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${receiptHtmlEscape(title)}</title><style>
body{font:16px system-ui,sans-serif;background:#f4f6f8;color:#17232d;margin:0;padding:24px}
main{max-width:680px;margin:0 auto;background:#fff;border:1px solid #d7dee5;border-radius:14px;padding:24px}
h1{font-size:1.35rem}h2{font-size:1rem;color:#38546a;margin-top:0}
dl{display:grid;grid-template-columns:minmax(130px,1fr) 2fr;gap:10px 16px}
dt{font-weight:650}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
a{display:inline-block;margin-top:20px;padding:12px 18px;background:#123b59;color:#fff;border-radius:8px;text-decoration:none}
small{display:block;margin-top:18px;color:#596771}
@media(max-width:520px){dl{grid-template-columns:1fr;gap:4px}dd{margin-bottom:10px}}
</style></head><body><main><h1>${receiptHtmlEscape(snapshot.companyName)}</h1>
<h2>${receiptHtmlEscape(snapshot.format.toLocaleUpperCase('es-CO'))} · ${receiptHtmlEscape(snapshot.branchName)}</h2>
<dl>${rows}</dl><a href="/comprobante/${encodeURIComponent(token)}/imagen">Descargar imagen PNG</a>
<small>Comprobante interno de registro. No es factura electrónica. Los datos corresponden al momento de emisión.</small>
</main></body></html>`);
    } catch (error) { next(error); }
  });
  app.get('/comprobante/:token/imagen', limitPublicReceipt, async (req, res, next) => {
    publicReceiptHeaders(res);
    try {
      const token = typeof req.params.token === 'string' ? req.params.token : '';
      const snapshot = await publicReceiptSnapshot(token);
      if (!snapshot) return missingReceipt(res);
      const png = await renderReceiptPng(snapshot);
      return res.status(200).type('png').set('Content-Disposition', 'attachment; filename="comprobante.png"').send(png);
    } catch (error) { next(error); }
  });
  app.use('/graphql', (req, res, next) => {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test' && !req.secure) {
      return res.status(426).json({
        errors: [{ message: 'HTTPS is required', extensions: { code: 'FORBIDDEN' } }],
      });
    }
    next();
  });
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use(morgan(
    (tokens, req, res) => [
      tokens.method(req, res), req.path, tokens.status(req, res), `${tokens['response-time'](req, res)}ms`,
    ].join(' '),
    { skip: (req, _res) => process.env.NODE_ENV === 'test' || req.path.startsWith('/comprobante/') },
  ));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.all('/graphql', createHandler<{ auth: Awaited<ReturnType<typeof authenticateRequest>> }>({
    schema,
    context: async (req) => {
      try {
        const body = (req.raw as IncomingMessage & { body?: unknown }).body;
        const allowExpiredPayment = receiptLinkManagementOnly(body);
        const auth = await authenticateRequest(req.raw.headers.authorization, { allowExpiredPayment });
        return { auth };
      } catch (error) {
        // graphql-http does not map errors thrown from `context` to a GraphQL error response; it
        // would otherwise surface as a bare HTTP 500 with no body, which the Android client treats
        // as "server unavailable" instead of "session expired". Return the response tuple directly
        // so the real status code (401 for an expired/invalid token, etc.) reaches the client.
        const formatted = errorFormatter(error instanceof Error ? error : new Error(String(error)));
        const status = httpStatusForCode(formatted.extensions.code);
        return [
          JSON.stringify({ errors: [formatted] }),
          { status, statusText: 'OK', headers: { 'content-type': 'application/json' } },
        ] as const;
      }

    },
    formatError: errorFormatter,
  }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (error as { status?: number }).status;
    const isBadRequest = status === 400 || status === 413;
    res.status(isBadRequest ? status : 500).json({
      errors: [{
        message: isBadRequest ? 'Invalid or oversized request body' : 'Internal server error',
        extensions: { code: isBadRequest ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR' },
      }],
    });
  });
  return app;
}
