import { GraphQLError } from 'graphql';

export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR'
  | 'CONFLICT' | 'IDEMPOTENCY_MISMATCH' | 'BUSINESS_RULE' | 'CONFIGURATION_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export function fail(code: ErrorCode, message: string): never {
  throw new GraphQLError(message, { extensions: { code } });
}

export function mapTransactionError(error: unknown): Error {
  const code = (error as { code?: string }).code;
  if (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT') {
    return new GraphQLError(
      'Concurrent database transaction was rolled back; retry the same operationId',
      { extensions: { code: 'CONFLICT', retryable: true } },
    );
  }
  return error instanceof Error ? error : new Error('Unknown database error');
}

// HTTP status to use when an error must be reported before GraphQL execution starts (e.g. from the
// request `context` callback), where graphql-http cannot map extensions.code to a status on its own.
export function httpStatusForCode(code: unknown): number {
  switch (code) {
    case 'UNAUTHENTICATED': return 401;
    case 'FORBIDDEN': return 403;
    case 'NOT_FOUND': return 404;
    case 'VALIDATION_ERROR': return 400;
    case 'CONFLICT': case 'IDEMPOTENCY_MISMATCH': return 409;
    default: return 500;
  }
}

export function errorFormatter(input: Readonly<GraphQLError | Error>): GraphQLError {
  const error = input instanceof GraphQLError ? input : new GraphQLError(input.message);
  const code = error.extensions.code;
  if (typeof code === 'string') return error;
  if (!error.path) return new GraphQLError(error.message, {
    nodes: error.nodes, source: error.source, positions: error.positions, path: error.path,
    originalError: error.originalError, extensions: { ...error.extensions, code: 'VALIDATION_ERROR' },
  });
  return new GraphQLError('Internal server error', {
    nodes: error.nodes, path: error.path, extensions: { code: 'INTERNAL_SERVER_ERROR' },
  });
}
