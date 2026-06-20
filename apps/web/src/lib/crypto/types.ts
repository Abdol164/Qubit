/**
 * Encrypted payload exchanged between sender and recipient.
 * All fields are base64-encoded. Names match the backend CreateMessageDto
 * so the object can be spread directly into the POST /messages body.
 */
export interface EncryptedPayload {
  /** base64 — ML-KEM-768 ciphertext, always 1088 bytes before encoding */
  kemCiphertext: string;
  /** base64 — AES-256-GCM ciphertext (plaintext length + 16-byte GCM tag) */
  ciphertext: string;
  /** base64 — 12-byte random AES-GCM IV */
  nonce: string;
}
