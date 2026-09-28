/**
 * Rate-limiting middleware configuration.
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/** Strict limiter for login / setup (20 attempts per 15 minutes, only failed ones count) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General API limiter (configurable via API_RATE_LIMIT, default 600/min) */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.apiRateLimit,
  message: { success: false, error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Push endpoint limiter (per IP) */
export const pushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { ok: false, success: false, error: 'Too many push requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Strict limiter for notification tests (10 requests per minute) */
export const notificationTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many test requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
