import argon2 from 'argon2';

/**
 * Hashes a password using Argon2id.
 * Argon2 is more resistant to GPU-based brute force and side-channel attacks than bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Compares a plain text password with an Argon2 hash.
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch (error) {
    return false;
  }
}
