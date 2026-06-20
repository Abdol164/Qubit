import { MlKem768 } from 'mlkem';
import { toBase64, fromBase64 } from './utils';

const PK_KEY = 'qubit_mlkem_pk';
const SK_KEY = 'qubit_mlkem_sk';

/**
 * Generate a fresh ML-KEM-768 keypair.
 * Returns pk (1184 bytes) and sk (2400 bytes).
 */
export async function generateMLKEMKeypair(): Promise<{ pk: Uint8Array; sk: Uint8Array }> {
  const kem = new MlKem768();
  const [pk, sk] = await kem.generateKeyPair();
  return { pk, sk };
}

/**
 * Persist keypair to localStorage as base64.
 *
 * SECURITY NOTE: storing the raw private key in localStorage is XSS-vulnerable.
 * Production fix: encrypt SK with a password-derived AES key (non-extractable)
 * and store the encrypted blob in IndexedDB instead.
 */
export function saveKeypairToStorage(pk: Uint8Array, sk: Uint8Array): void {
  localStorage.setItem(PK_KEY, toBase64(pk));
  localStorage.setItem(SK_KEY, toBase64(sk));
}

/** Load keypair from localStorage. Returns null if none stored. */
export function loadKeypairFromStorage(): { pk: Uint8Array; sk: Uint8Array } | null {
  const pkB64 = localStorage.getItem(PK_KEY);
  const skB64 = localStorage.getItem(SK_KEY);
  if (!pkB64 || !skB64) return null;
  return { pk: fromBase64(pkB64), sk: fromBase64(skB64) };
}
