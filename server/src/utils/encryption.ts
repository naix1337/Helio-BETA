/**
 * AES-256-GCM encryption/decryption for sensitive config values.
 *
 * Uses the app's JWT secret as the encryption key (SHA-256 derived),
 * so the key never appears in the database. Every encryption call
 * generates a fresh random IV.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function deriveKey(): Buffer {
  return createHash('sha256').update(config.jwtSecret).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns format: hex(iv):hex(authTag):hex(ciphertext)
 */
export function encrypt(text: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string previously encrypted with encrypt().
 * Expects format: hex(iv):hex(authTag):hex(ciphertext)
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const key = deriveKey();
  const iv = Buffer.from(ivHex!, 'hex');
  const authTag = Buffer.from(authTagHex!, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted!, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check whether a string looks like it was encrypted with encrypt().
 */
export function isEncrypted(text: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(text);
}
