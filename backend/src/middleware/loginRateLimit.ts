import { rateLimit } from 'express-rate-limit';

export const LOGIN_RATE_LIMIT = 5;
export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: LOGIN_RATE_WINDOW_MS,
    limit: LOGIN_RATE_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      message: 'Too many sign-in attempts. Please try again later.',
    },
  });
}
