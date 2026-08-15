import crypto from 'crypto';

// Simple, dependency-free password hashing using Node's built-in scrypt.
// Format stored: "salt:hash" (both hex-encoded).
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const attemptHash = crypto.scryptSync(plain, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attemptHash, 'hex'));
  } catch {
    return false;
  }
}
