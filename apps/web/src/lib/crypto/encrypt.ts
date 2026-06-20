import { MlKem768 } from 'mlkem';
import { toBase64 } from './utils';
import type { EncryptedPayload } from './types';

/**
 * Encrypt a plaintext message for a recipient using their ML-KEM-768 public key.
 *
 * Protocol:
 *   1. ML-KEM encap(recipientPk) → [kemCt (1088B), sharedSecret (32B)]
 *   2. Import sharedSecret as AES-256-GCM key (non-extractable)
 *   3. Generate random 12-byte IV
 *   4. AES-GCM encrypt plaintext → ciphertext (includes 16B auth tag)
 *   5. Return all three components as base64
 */
export async function encryptMessage(
  recipientPk: Uint8Array,
  plaintext: string,
): Promise<EncryptedPayload> {
  const kem = new MlKem768();
  const [kemCt, sharedSecret] = await kem.encap(recipientPk);
  // Wrap in a plain Uint8Array to satisfy TypeScript's ArrayBuffer (not ArrayBufferLike) constraint
  const secretBytes = new Uint8Array(sharedSecret);
  const plainBytes = new Uint8Array(new TextEncoder().encode(plaintext));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plainBytes,
  );

  return {
    kemCiphertext: toBase64(kemCt),
    ciphertext: toBase64(new Uint8Array(ciphertextBuf)),
    nonce: toBase64(iv),
  };
}
