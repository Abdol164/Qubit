import { useState } from 'react';
import type { EncryptedPayload } from '../lib/crypto/types';

function b64Bytes(b64: string): number {
  // base64url or standard — strip padding, compute byte length
  const stripped = b64.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  return Math.floor((stripped.length * 3) / 4);
}

function truncate(b64: string): string {
  if (b64.length <= 36) return b64;
  return `${b64.slice(0, 24)}…${b64.slice(-8)}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      style={{
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.2)',
        color: copied ? '#E60023' : 'rgba(255,255,255,0.4)',
        fontSize: 9,
        letterSpacing: 1,
        padding: '2px 6px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  const bytes = b64Bytes(value);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 3,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>
          {bytes} bytes
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
          wordBreak: 'break-all',
          flex: 1,
        }}>
          {truncate(value)}
        </span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export function ProofPanel({ raw }: { raw: EncryptedPayload }) {
  return (
    <div style={{
      background: '#060606',
      border: '1px solid rgba(230,0,35,0.25)',
      borderTop: '2px solid #E60023',
      padding: '12px 14px',
      marginTop: 2,
    }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
          color: '#E60023', fontWeight: 700,
        }}>
          ENCRYPTED PAYLOAD
        </span>
        <span style={{
          fontSize: 9, color: 'rgba(255,255,255,0.25)', marginLeft: 8, letterSpacing: 0.5,
        }}>
          what the server stores
        </span>
      </div>

      <div style={{
        fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 1,
        marginBottom: 10, paddingBottom: 8,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        ML-KEM-768 + AES-256-GCM
      </div>

      <FieldRow label="KEM Ciphertext" value={raw.kemCiphertext} />
      <FieldRow label="AES-GCM Ciphertext" value={raw.ciphertext} />
      <FieldRow label="Nonce" value={raw.nonce} />
    </div>
  );
}
