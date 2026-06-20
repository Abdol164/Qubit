import { useEffect, useRef, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { io, Socket } from 'socket.io-client';
import { generateMLKEMKeypair } from '../lib/crypto/keygen';
import { encryptMessage } from '../lib/crypto/encrypt';
import { decryptMessage } from '../lib/crypto/decrypt';
import { api } from '../lib/api/client';
import type { WsMessage } from '../hooks/useSocket';

const AGENTS = {
  alpha: {
    label: 'Agent Alpha',
    glyph: 'Aα',
    address: '0x1a40bbc071a16ecbc7cdd7309b0e36d33d823a3d6b985e894f60761c12a40ead',
    peer:    '0x1c31ef3164517d63c6feb49305590a7cb6dbfff2486d4fb4bd274e14ea455045',
  },
  beta: {
    label: 'Agent Beta',
    glyph: 'Aβ',
    address: '0x1c31ef3164517d63c6feb49305590a7cb6dbfff2486d4fb4bd274e14ea455045',
    peer:    '0x1a40bbc071a16ecbc7cdd7309b0e36d33d823a3d6b985e894f60761c12a40ead',
  },
} as const;

type Role = keyof typeof AGENTS;

const RED    = '#E60023';
const BG     = '#0a0a0a';
const SURF   = '#0d0d0d';
const BORDER = 'rgba(255,255,255,0.1)';
const MUTED  = 'rgba(255,255,255,0.35)';
const GREEN  = '#4ade80';
const AMBER  = '#f59e0b';

type LogKind = 'sys' | 'sent' | 'recv' | 'ok' | 'err';
interface LogLine { kind: LogKind; text: string; raw?: string; digest?: string; explorerUrl?: string }

function toB64(b: Uint8Array) { return btoa(String.fromCharCode(...b)); }
function fromB64(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

function addr(a: string) { return a.slice(0, 8) + '…' + a.slice(-6); }

function Line({ line }: { line: LogLine }) {
  const color = line.kind === 'ok' ? GREEN : line.kind === 'err' ? RED : line.kind === 'sent' ? RED : line.kind === 'recv' ? AMBER : MUTED;
  const prefix = line.kind === 'ok' ? '✓' : line.kind === 'err' ? '✗' : line.kind === 'sent' ? '↑' : line.kind === 'recv' ? '↓' : '·';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, lineHeight: 1.7 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ color, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>{prefix}</span>
        <span style={{ color: line.kind === 'sys' ? MUTED : '#fff' }}>{line.text}</span>
      </div>
      {line.explorerUrl && (
        <a
          href={line.explorerUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            marginLeft: 18, fontSize: 10, color: GREEN,
            fontFamily: "'JetBrains Mono', monospace",
            textDecoration: 'underline', letterSpacing: 0.5,
          }}
        >
          → Verify on Sui Explorer ↗
        </a>
      )}
    </div>
  );
}

export function AgentPage() {
  const { role } = useParams({ from: '/agent/$role' });
  const agent = AGENTS[role as Role];

  const [log, setLog]       = useState<LogLine[]>([]);
  const [status, setStatus] = useState<'booting' | 'ready' | 'busy' | 'done'>('booting');
  const [sending, setSending] = useState(false);

  const skRef     = useRef<Uint8Array | null>(null);
  const tokenRef  = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function push(kind: LogKind, text: string, extra: Partial<LogLine> = {}) {
    setLog(p => [...p, { kind, text, ...extra }]);
  }

  useEffect(() => {
    if (!agent) return;
    boot();
    return () => { socketRef.current?.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  async function boot() {
    push('sys', `${agent.label} initialising…`);

    // 1. Generate ML-KEM-768 keypair
    push('sys', 'Generating ML-KEM-768 keypair (NIST FIPS 203)…');
    const { pk, sk } = await generateMLKEMKeypair();
    skRef.current = sk;
    push('ok', `Keypair ready  pk=${pk.length}B  sk=${sk.length}B`);

    // 2. Authenticate
    push('sys', 'Authenticating with Qubit gateway…');
    try {
      const { nonce } = await api.get(`/auth/nonce?address=${agent.address}`);
      const resp = await api.post('/auth/login', { address: agent.address, nonce });
      tokenRef.current = resp.access_token;
      push('ok', 'JWT acquired');
    } catch (e: any) {
      push('err', `Auth failed: ${e.message}`);
      return;
    }

    // 3. Push pubkey to backend
    push('sys', 'Registering ML-KEM public key with Qubit…');
    try {
      await fetch('http://localhost:3001/api/users/pubkey', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ pubKey: toB64(pk) }),
      });
      push('ok', 'Public key registered');
    } catch (e: any) {
      push('err', `Pubkey push failed: ${e.message}`);
    }

    // 4. Connect WebSocket
    push('sys', 'Opening WebSocket to Qubit gateway…');
    const socket = io('http://localhost:3001', {
      auth: { token: tokenRef.current },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      push('ok', `WebSocket connected  (room: ${addr(agent.address)})`);
      setStatus('ready');
      if (role === 'beta') push('sys', 'Listening for incoming encrypted messages…');
    });

    socket.on('connect_error', (err) => {
      push('err', `WebSocket error: ${err.message}`);
      setStatus('ready');
    });

    socket.on('message:new', async (msg: WsMessage) => {
      push('recv', `Encrypted message received via WebSocket`);
      push('sys', `KEM CT: ${msg.kemCiphertext.slice(0, 24)}…  (${Math.round(msg.kemCiphertext.length * 3 / 4)}B)`);
      push('sys', `AES-GCM CT: ${msg.ciphertext.slice(0, 24)}…  (${Math.round(msg.ciphertext.length * 3 / 4)}B)`);
      push('sys', 'Decrypting with ML-KEM-768 secret key…');

      if (!skRef.current) { push('err', 'No secret key — cannot decrypt'); return; }

      try {
        const plaintext = await decryptMessage(skRef.current, msg);
        const parsed = JSON.parse(plaintext);
        push('ok', `Decrypted: "${parsed.memo}"`);
        push('sys', `Task: ${parsed.task}  ·  Amount: ${parsed.amount_mist} MIST`);
        push('sys', 'Executing Sui transaction autonomously…');
        const execResp = await fetch('http://localhost:3001/api/demo/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: parsed.recipient, amount_mist: parsed.amount_mist }),
        });
        const { digest, explorerUrl } = await execResp.json();
        push('ok', `TX: ${digest}`, { digest, explorerUrl });
        setStatus('done');
      } catch (e: any) {
        push('err', `Decryption failed: ${e.message}`);
      }
    });
  }

  async function send() {
    if (sending || !tokenRef.current) return;
    setSending(true);
    setStatus('busy');

    push('sys', `Fetching Agent Beta's ML-KEM public key…`);
    try {
      const resp = await fetch(`http://localhost:3001/api/users/${agent.peer}/pubkey`);
      const { pubKey } = await resp.json();
      const peerPk = fromB64(pubKey);
      push('ok', `Peer pubkey: ${peerPk.length}B`);

      const instruction = JSON.stringify({
        task: 'sui_transfer',
        recipient: agent.address,
        amount_mist: 1000,
        memo: 'Coordination fee — quantum-proof instruction from Agent Alpha',
        timestamp: Date.now(),
      });

      push('sys', 'Encrypting with ML-KEM-768 + AES-256-GCM…');
      const payload = await encryptMessage(peerPk, instruction);
      push('ok', `KEM CT: ${payload.kemCiphertext.slice(0, 24)}…  (${Math.round(payload.kemCiphertext.length * 3 / 4)}B)`);
      push('ok', `AES-GCM CT: ${payload.ciphertext.slice(0, 24)}…  (${Math.round(payload.ciphertext.length * 3 / 4)}B)`);
      push('sys', 'Sending via Qubit secure channel…');

      await fetch('http://localhost:3001/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ recipientAddress: agent.peer, ...payload }),
      });

      push('sent', 'Encrypted instruction delivered — server stored ciphertext only');
      setStatus('done');
    } catch (e: any) {
      push('err', `Send failed: ${e.message}`);
      setStatus('ready');
    } finally {
      setSending(false);
    }
  }

  if (!agent) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        Unknown role. Use <code style={{ marginLeft: 8 }}>/agent/alpha</code> or <code style={{ marginLeft: 8 }}>/agent/beta</code>
      </div>
    );
  }

  const statusColor = status === 'ready' ? GREEN : status === 'done' ? GREEN : status === 'busy' ? AMBER : MUTED;
  const statusLabel = status === 'ready' ? 'READY' : status === 'done' ? 'DONE' : status === 'busy' ? 'WORKING…' : 'BOOTING…';

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', gap: 16,
        background: SURF,
      }}>
        <div style={{
          width: 40, height: 40,
          border: `2px solid ${RED}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: RED, flexShrink: 0,
        }}>
          {agent.glyph}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{agent.label.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
            {agent.address}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          <span style={{ fontSize: 10, letterSpacing: 1.5, color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      {/* Log */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 24px',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 2, marginBottom: 10 }}>
          QUBIT · ML-KEM-768 + AES-256-GCM · Sui Testnet
        </div>
        {log.map((line, i) => <Line key={i} line={line} />)}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      {role === 'alpha' && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 24px', background: SURF }}>
          <button
            onClick={send}
            disabled={status !== 'ready' && status !== 'done' || sending}
            style={{
              background: (!sending && (status === 'ready' || status === 'done')) ? RED : 'rgba(230,0,35,0.25)',
              border: 'none', color: '#fff',
              padding: '10px 32px',
              fontSize: 11, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase',
              cursor: (!sending && (status === 'ready' || status === 'done')) ? 'pointer' : 'not-allowed',
            }}
          >
            {sending ? 'SENDING…' : 'SEND ENCRYPTED INSTRUCTION'}
          </button>
          <span style={{ marginLeft: 16, fontSize: 10, color: MUTED }}>
            → Agent Beta will receive via WebSocket in real time
          </span>
        </div>
      )}

      {role === 'beta' && status === 'done' && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 24px', background: SURF }}>
          <span style={{ fontSize: 10, color: GREEN, letterSpacing: 1 }}>
            ✓ Instruction received, decrypted, and executed autonomously.
          </span>
        </div>
      )}
    </div>
  );
}
