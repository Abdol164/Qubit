import { describe, it, expect, beforeEach } from 'vitest';
import { generateMLKEMKeypair, saveKeypairToStorage, loadKeypairFromStorage } from './keygen';
import { encryptMessage } from './encrypt';
import { decryptMessage } from './decrypt';
import { toBase64, fromBase64 } from './utils';

describe('Base64 utilities', () => {
  it('round-trips arbitrary bytes', () => {
    const original = crypto.getRandomValues(new Uint8Array(32));
    expect(fromBase64(toBase64(original))).toEqual(original);
  });
});

describe('generateMLKEMKeypair', () => {
  it('produces correct byte lengths for ML-KEM-768', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    expect(pk.byteLength).toBe(1184);
    expect(sk.byteLength).toBe(2400);
  });

  it('produces Uint8Array instances', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    expect(pk).toBeInstanceOf(Uint8Array);
    expect(sk).toBeInstanceOf(Uint8Array);
  });
});

describe('saveKeypairToStorage / loadKeypairFromStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadKeypairFromStorage()).toBeNull();
  });

  it('round-trips a keypair through localStorage', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    saveKeypairToStorage(pk, sk);
    const loaded = loadKeypairFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded!.pk).toEqual(pk);
    expect(loaded!.sk).toEqual(sk);
  });

  it('stores data under the correct localStorage keys', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    saveKeypairToStorage(pk, sk);
    expect(localStorage.getItem('qubit_mlkem_pk')).not.toBeNull();
    expect(localStorage.getItem('qubit_mlkem_sk')).not.toBeNull();
  });
});

describe('encryptMessage / decryptMessage', () => {
  it('payload contains three base64 strings', async () => {
    const { pk } = await generateMLKEMKeypair();
    const payload = await encryptMessage(pk, 'hello');
    expect(typeof payload.kemCiphertext).toBe('string');
    expect(typeof payload.ciphertext).toBe('string');
    expect(typeof payload.nonce).toBe('string');
    expect(() => fromBase64(payload.kemCiphertext)).not.toThrow();
    expect(() => fromBase64(payload.ciphertext)).not.toThrow();
    expect(() => fromBase64(payload.nonce)).not.toThrow();
  });

  it('kemCiphertext decodes to 1088 bytes (ML-KEM-768 encap output)', async () => {
    const { pk } = await generateMLKEMKeypair();
    const payload = await encryptMessage(pk, 'test');
    expect(fromBase64(payload.kemCiphertext).byteLength).toBe(1088);
  });

  it('nonce decodes to 12 bytes (AES-GCM IV)', async () => {
    const { pk } = await generateMLKEMKeypair();
    const payload = await encryptMessage(pk, 'test');
    expect(fromBase64(payload.nonce).byteLength).toBe(12);
  });

  it('full encrypt → decrypt roundtrip returns original plaintext', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    const plaintext = 'Post-quantum secure message from Qubit!';
    const payload = await encryptMessage(pk, plaintext);
    expect(await decryptMessage(sk, payload)).toBe(plaintext);
  });

  it('roundtrip works for empty string', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    const payload = await encryptMessage(pk, '');
    expect(await decryptMessage(sk, payload)).toBe('');
  });

  it('roundtrip works for unicode and emoji', async () => {
    const { pk, sk } = await generateMLKEMKeypair();
    const plaintext = '量子暗号 🔐 post-quantum';
    expect(await decryptMessage(sk, await encryptMessage(pk, plaintext))).toBe(plaintext);
  });

  it('decryptMessage throws when given the wrong private key', async () => {
    const { pk } = await generateMLKEMKeypair();
    const { sk: wrongSk } = await generateMLKEMKeypair();
    const payload = await encryptMessage(pk, 'secret');
    await expect(decryptMessage(wrongSk, payload)).rejects.toThrow();
  });
});
