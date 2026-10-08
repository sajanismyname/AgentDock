import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits for GCM

export class EncryptionService {
  private static getKey(): Buffer {
    // Derive a fixed 32-byte key from the configured AGENT_ENCRYPTION_KEY using SHA-256
    return crypto.createHash('sha256').update(env.AGENT_ENCRYPTION_KEY).digest();
  }

  /**
   * Encrypt plaintext string using AES-256-GCM.
   * Returns formatted string: `iv:authTag:ciphertext` (hex encoded).
   */
  static encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt AES-256-GCM formatted string (`iv:authTag:ciphertext`).
   */
  static decrypt(encryptedPayload: string): string {
    if (!encryptedPayload) {
      return '';
    }

    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, cipherTextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(cipherTextHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
