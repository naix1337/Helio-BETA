/**
 * Rate-limiting middleware configuration.
 *
 * Applies different limits to auth endpoints (strict) and
 * general API endpoints (moderate).
 */

import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for login / register (10 requests per 15 minutes).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Moderate limiter for general API (120 requests per minute).
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limiter for notification tests (5 requests per minute).
 */
export const notificationTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many test requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
