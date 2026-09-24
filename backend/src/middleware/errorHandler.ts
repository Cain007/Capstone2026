import type { ErrorRequestHandler } from 'express';
import { logError } from '../utils/safeLogger.js';

export class CorsOriginError extends Error {
  constructor() {
    super('Origin is not allowed');
    this.name = 'CorsOriginError';
  }
}

function isMalformedJson(error: unknown) {
  return (
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'body' in error
  );
}

function isOversizedJson(error: unknown) {
  return (
    error instanceof Error &&
    'type' in error &&
    error.type === 'entity.too.large'
  );
}

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof CorsOriginError) {
    response.status(403).json({ message: 'Origin is not allowed' });
    return;
  }

  if (isMalformedJson(error)) {
    response.status(400).json({ message: 'Malformed JSON request body' });
    return;
  }

  if (isOversizedJson(error)) {
    response.status(413).json({ message: 'Request body is too large' });
    return;
  }

  logError('Unhandled request error', error, {
    method: request.method,
    path: request.path,
  });
  response.status(500).json({ message: 'Internal server error' });
};
