import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Layout } from '../components/Layout';
import { AddressDisplay } from '../components/AddressDisplay';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import type { WsMessage } from '../hooks/useSocket';
import { decryptMessage } from '../lib/crypto/decrypt';
import { encryptMessage } from '../lib/crypto/encrypt';
import { fetchRecipientPublicKey } from '../lib/sui/registry';
import { api } from '../lib/api/client';
import { ProofPanel } from '../components/ProofPanel';
import type { EncryptedPayload } from '../lib/crypto/types';

interface DecryptedMessage {
  id?: string;
  text: string;
  mine: boolean;
  createdAt: string;
  failed?: boolean;
  raw?: EncryptedPayload;
}

function addToContacts(address: string) {
  try {
    const key = 'qubit_contacts';
    const contacts: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!contacts.includes(address)) {
      localStorage.setItem(key, JSON.stringify([address, ...contacts]));
    }
  } catch { /* ignore */ }
}

export function ChatThreadPage() {
  const { address } = useParams({ from: '/chat/$address' });
  const userId = useAuthStore((s) => s.userId);
  const mlkemSk = useAuthStore((s) => s.mlkemSk);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proofOpen, setProofOpen] = useState<Set<string>>(() => new Set());

  function toggleProof(key: string) {
    setProofOpen(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Keep contact list in sync
  useEffect(() => { addToContacts(address); }, [address]);

  // Load thread on mount
  useEffect(() => {
    if (!mlkemSk) return;
    setLoading(true);

    api.get(`/messages/${address}`)
      .then(async (raw: Array<{
        id: string; senderId: string; kemCiphertext: string;
        ciphertext: string; nonce: string; createdAt: string;
      }>) => {
        const decrypted = await Promise.all(
          raw.map(async (m) => {
            const rawPayload: EncryptedPayload = { kemCiphertext: m.kemCiphertext, ciphertext: m.ciphertext, nonce: m.nonce };
            if (m.senderId === userId) {
              return { id: m.id, text: '(sent — encrypted for recipient)', mine: true, createdAt: m.createdAt, raw: rawPayload };
            }
            try {
              const text = await decryptMessage(mlkemSk, m);
              return { id: m.id, text, mine: false, createdAt: m.createdAt, raw: rawPayload };
            } catch {
              return { id: m.id, text: '[decryption failed]', mine: false, createdAt: m.createdAt, failed: true, raw: rawPayload };
            }
          }),
        );
        setMessages(decrypted);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [address, userId, mlkemSk]);

  // WebSocket: incoming messages
  const { isConnected } = useSocket((msg: WsMessage) => {
    if (msg.senderAddress !== address || !mlkemSk) return;
    const rawPayload: EncryptedPayload = { kemCiphertext: msg.kemCiphertext, ciphertext: msg.ciphertext, nonce: msg.nonce };
    decryptMessage(mlkemSk, msg)
      .then((text) =>
        setMessages((prev) => [
          ...prev,
          { id: msg.id, text, mine: false, createdAt: msg.createdAt, raw: rawPayload },
        ]),
      )
      .catch(() =>
        setMessages((prev) => [
          ...prev,
          { id: msg.id, text: '[decryption failed]', mine: false, createdAt: msg.createdAt, failed: true, raw: rawPayload },
        ]),
      );
  });

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const pk = await fetchRecipientPublicKey(address);
      const payload = await encryptMessage(pk, text);
      await api.post('/messages', { recipientAddress: address, ...payload });
      setMessages((prev) => [...prev, { text, mine: true, createdAt: new Date().toISOString(), raw: payload }]);
      setInput('');
    } catch (err) {
      alert(`Send failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout isConnected={isConnected}>
      <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)' }}>
        {/* Thread header */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={() => navigate({ to: '/chat' })}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, padding: 0 }}
          >
            ←
          </button>
          <AddressDisplay address={address} editable />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
              Loading messages…
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
              No messages yet. Say something!
            </div>
          )}

          {messages.map((m, i) => {
            const key = m.id ?? String(i);
            const open = proofOpen.has(key);
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.mine ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '10px 14px',
                    border: m.mine ? '2px solid #E60023' : '2px solid white',
                    background: m.mine ? 'rgba(230,0,35,0.08)' : 'rgba(255,255,255,0.04)',
                    color: m.failed ? 'rgba(255,255,255,0.3)' : 'white',
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontStyle: m.failed ? 'italic' : 'normal',
                  }}
                >
                  {m.text}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' }}>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                {m.raw && (
                  <div style={{ maxWidth: '70%', width: '100%' }}>
                    <button
                      onClick={() => toggleProof(key)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: open ? '#E60023' : 'rgba(255,255,255,0.25)',
                        fontSize: 9,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        padding: '4px 0',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {open ? '▴ PROOF' : '▾ PROOF'}
                    </button>
                    {open && <ProofPanel raw={m.raw} />}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          style={{
            borderTop: '2px solid white',
            padding: '12px 24px',
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message…"
            disabled={sending}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '10px 14px',
              fontSize: 14,
            }}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            style={{
              background: sending ? 'rgba(230,0,35,0.5)' : '#E60023',
              border: 'none',
              color: 'white',
              padding: '10px 24px',
              cursor: sending ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              opacity: !input.trim() && !sending ? 0.5 : 1,
            }}
          >
            {sending ? '…' : 'SEND'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
