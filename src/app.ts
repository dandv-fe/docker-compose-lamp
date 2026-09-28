import cors from 'cors';
import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import morgan from 'morgan';
import { schema } from './graphql/schema.js';
import { authenticateRequest } from './services/auth.js';
import { errorFormatter, httpStatusForCode } from './services/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY || false);
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
    { skip: (_req, _res) => process.env.NODE_ENV === 'test' },
  ));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.all('/graphql', createHandler<{ auth: Awaited<ReturnType<typeof authenticateRequest>> }>({
    schema,
    context: async (req) => {
      try {
        const auth = await authenticateRequest(req.raw.headers.authorization);
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
