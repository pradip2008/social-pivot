import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    // Fallback: derive key from session secret (not ideal for prod)
    const secret = process.env.SESSION_SECRET || 'complex-password-at-least-32-characters-long-for-security';
    return crypto.createHash('sha256').update(secret).digest();
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptToken(plaintext) {
  if (!plaintext) return plaintext;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input format: iv:authTag:ciphertext (all base64)
 */
export function decryptToken(encrypted) {
  if (!encrypted) return encrypted;

  // If it doesn't look encrypted (no colons), return as-is (legacy plain tokens)
  if (!encrypted.includes(':') || encrypted.split(':').length !== 3) {
    return encrypted;
  }

  try {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (e) {
    // If decryption fails, it might be a legacy plain token
    console.warn('Token decryption failed, returning as-is:', e.message);
    return encrypted;
  }
}

/**
 * Check if a token is already encrypted
 */
export function isEncrypted(token) {
  if (!token) return false;
  const parts = token.split(':');
  return parts.length === 3;
}
