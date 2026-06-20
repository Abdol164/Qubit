import { MlKem768 } from 'mlkem';
import { fromBase64 } from './utils';
import type { EncryptedPayload } from './types';

/**
 * Decrypt an EncryptedPayload using the recipient's ML-KEM-768 private key.
 *
 * Throws DOMException 'OperationError' if SK is wrong or payload was tampered.
 * (ML-KEM uses FIPS 203 §6.3 implicit rejection: decap never throws but returns
 *  a wrong shared secret, which causes AES-GCM auth tag verification to fail.)
 */
export async function decryptMessage(
  sk: Uint8Array,
  payload: EncryptedPayload,
): Promise<string> {
  const kem = new MlKem768();
  const sharedSecret = await kem.decap(fromBase64(payload.kemCiphertext), sk);
  // Wrap in a plain Uint8Array to satisfy TypeScript's ArrayBuffer (not ArrayBufferLike) constraint
  const secretBytes = new Uint8Array(sharedSecret);
  const ivBytes = new Uint8Array(fromBase64(payload.nonce));
  const ctBytes = new Uint8Array(fromBase64(payload.ciphertext));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    ctBytes,
  );

  return new TextDecoder().decode(plaintextBuf);
}
