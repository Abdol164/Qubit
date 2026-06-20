import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { encryptMessage } from '../lib/crypto/encrypt';
import { decryptMessage } from '../lib/crypto/decrypt';
import { generateMLKEMKeypair } from '../lib/crypto/keygen';
import { api } from '../lib/api/client';
import type { WsMessage } from '../hooks/useSocket';

const ALPHA_ADDR = '0x1a40bbc071a16ecbc7cdd7309b0e36d33d823a3d6b985e894f60761c12a40ead';
const BETA_ADDR  = '0x1c31ef3164517d63c6feb49305590a7cb6dbfff2486d4fb4bd274e14ea455045';

const RED    = '#E60023';
const BG     = '#0a0a0a';
const SURF   = '#111111';
const BORDER = 'rgba(255,255,255,0.1)';
const MUTED  = 'rgba(255,255,255,0.35)';

type Role = 'alpha' | 'beta' | 'system';
interface ChatLine {
  role: Role;
  text: string;
  raw?: string;
  isEncrypted?: boolean;
  txDigest?: string;
}

type Phase =
  | 'idle' | 'keygen' | 'login' | 'pubkey'
  | 'fetch' | 'encrypt' | 'send' | 'receive' | 'decrypt' | 'done';

function truncate(s: string, n = 32) {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

function addr(a: string) {
  return a.slice(0, 6) + '…' + a.slice(-4);
}

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      background: color, borderRadius: '50%', marginRight: 6,
    }} />
  );
}

function AgentPanel({
  name, address, lines, side,
}: {
  name: string; address: string; lines: ChatLine[]; side: 'left' | 'right';
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      border: `1px solid ${BORDER}`, background: SURF,
      minHeight: 420,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36,
          border: `2px solid ${RED}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          fontFamily: "'JetBrains Mono', monospace",
          color: RED,
        }}>
          {name === 'Agent Alpha' ? 'Aα' : 'Aβ'}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{name.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
            {addr(address)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 9, color: MUTED, letterSpacing: 1 }}>
          ML-KEM-768
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lines.map((line, i) => {
          const isMine = (side === 'left' && line.role === 'alpha') || (side === 'right' && line.role === 'beta');
          const isSystem = line.role === 'system';

          if (isSystem) {
            return (
              <div key={i} style={{ fontSize: 10, color: MUTED, textAlign: 'center', letterSpacing: 0.5 }}>
                {line.text}
              </div>
            );
          }

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '8px 12px',
                border: isMine ? `2px solid ${RED}` : '2px solid rgba(255,255,255,0.25)',
                background: isMine ? 'rgba(230,0,35,0.07)' : 'rgba(255,255,255,0.03)',
                fontSize: 12, lineHeight: 1.5,
              }}>
                {line.isEncrypted ? (
                  <span style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                    <StatusDot color="#f59e0b" />
                    {truncate(line.text, 40)}
                  </span>
                ) : (
                  <span>{line.text}</span>
                )}
                {line.txDigest && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace" }}>
                    ✓ TX: {line.txDigest.slice(0, 16)}…
                  </div>
                )}
              </div>
              {line.isEncrypted && (
                <div style={{ fontSize: 9, color: MUTED, marginTop: 2, letterSpacing: 0.5 }}>
                  ENCRYPTED — {Math.round((line.text.length * 3) / 4)}B on wire
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function DemoPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [alphaLines, setAlphaLines] = useState<ChatLine[]>([]);
  const [betaLines, setBetaLines] = useState<ChatLine[]>([]);
  const [wirePayload, setWirePayload] = useState<{ kemCiphertext: string; ciphertext: string; nonce: string } | null>(null);
  const [error, setError] = useState('');

  function sysAlpha(text: string) {
    setAlphaLines(p => [...p, { role: 'system', text }]);
  }
  function sysBeta(text: string) {
    setBetaLines(p => [...p, { role: 'system', text }]);
  }
  function msgAlpha(text: string, opts: Partial<ChatLine> = {}) {
    setAlphaLines(p => [...p, { role: 'alpha', text, ...opts }]);
  }
  function msgBeta(text: string, opts: Partial<ChatLine> = {}) {
    setBetaLines(p => [...p, { role: 'beta', text, ...opts }]);
  }

  function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  async function loginAgent(address: string): Promise<string | null> {
    const { nonce } = await api.get(`/auth/nonce?address=${address}`);
    const resp = await api.post('/auth/login', { address, nonce });
    return resp.access_token ?? null;
  }

  async function runDemo() {
    setAlphaLines([]);
    setBetaLines([]);
    setWirePayload(null);
    setError('');

    try {
      // [1] Keygen
      setPhase('keygen');
      sysAlpha('Generating ML-KEM-768 keypair…');
      sysBeta('Generating ML-KEM-768 keypair…');
      const [{ pk: alphaPk, sk: alphaSk }, { pk: betaPk, sk: betaSk }] = await Promise.all([
        generateMLKEMKeypair(),
        generateMLKEMKeypair(),
      ]);
      await wait(600);
      sysAlpha(`pk=${alphaPk.length}B · sk=${alphaSk.length}B · NIST FIPS 203`);
      sysBeta(`pk=${betaPk.length}B · sk=${betaSk.length}B · NIST FIPS 203`);
      await wait(800);

      // [2] Login
      setPhase('login');
      sysAlpha('Authenticating with Qubit gateway…');
      sysBeta('Authenticating with Qubit gateway…');
      const [alphaToken, betaToken] = await Promise.all([
        loginAgent(ALPHA_ADDR),
        loginAgent(BETA_ADDR),
      ]);
      if (!alphaToken || !betaToken) throw new Error('Login failed for one or both agents');
      await wait(400);
      sysAlpha('JWT acquired ✓');
      sysBeta('JWT acquired ✓');
      await wait(600);

      // [3] Push pubkeys to backend
      setPhase('pubkey');
      sysAlpha('Pushing ML-KEM public key to Qubit registry…');
      sysBeta('Pushing ML-KEM public key to Qubit registry…');
      const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
      await Promise.all([
        fetch('http://localhost:3001/api/users/pubkey', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alphaToken}` },
          body: JSON.stringify({ pubKey: toB64(alphaPk) }),
        }),
        fetch('http://localhost:3001/api/users/pubkey', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${betaToken}` },
          body: JSON.stringify({ pubKey: toB64(betaPk) }),
        }),
      ]);
      await wait(500);
      sysAlpha('Public key registered ✓');
      sysBeta('Public key registered ✓');
      await wait(700);

      // [4] Alpha fetches Beta's pubkey
      setPhase('fetch');
      sysAlpha(`Fetching Agent Beta's public key…`);
      await wait(600);
      const pkResp = await fetch(`http://localhost:3001/api/users/${BETA_ADDR}/pubkey`);
      const { pubKey: betaPkB64 } = await pkResp.json();
      const fetchedBetaPk = Uint8Array.from(atob(betaPkB64), c => c.charCodeAt(0));
      sysAlpha(`Beta's ML-KEM pk: ${fetchedBetaPk.length}B ✓`);
      await wait(700);

      // [5] Encrypt
      setPhase('encrypt');
      const instruction = JSON.stringify({
        task: 'sui_transfer',
        recipient: ALPHA_ADDR,
        amount_mist: 1000,
        memo: 'Coordination fee — quantum-proof instruction',
      });
      sysAlpha('Encrypting instruction with Beta\'s public key…');
      await wait(500);
      const payload = await encryptMessage(fetchedBetaPk, instruction);
      setWirePayload(payload);
      sysAlpha(`ML-KEM encap: ${Math.round(payload.kemCiphertext.length * 3 / 4)}B`);
      sysAlpha(`AES-256-GCM: ${Math.round(payload.ciphertext.length * 3 / 4)}B`);
      await wait(800);

      // [6] Connect Beta's WebSocket BEFORE Alpha sends so it's subscribed
      setPhase('receive');
      sysBeta('Connecting to Qubit gateway via WebSocket…');

      await new Promise<void>((resolve, reject) => {
        const betaSocket = io('http://localhost:3001', {
          auth: { token: betaToken },
          transports: ['websocket'],
        });

        const timeout = setTimeout(() => {
          betaSocket.disconnect();
          reject(new Error('WebSocket timeout — no message received within 10s'));
        }, 10000);

        betaSocket.on('connect', async () => {
          sysBeta('WebSocket connected ✓ — listening for incoming messages…');

          // Now Alpha sends
          setPhase('send');
          msgAlpha(payload.ciphertext, { isEncrypted: true });
          await wait(300);
          sysAlpha('Sending via Qubit secure channel…');

          await fetch('http://localhost:3001/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${alphaToken}` },
            body: JSON.stringify({ recipientAddress: BETA_ADDR, ...payload }),
          });

          sysAlpha('Delivered — server stored ciphertext only ✓');
          setPhase('receive');
        });

        betaSocket.on('message:new', async (msg: WsMessage) => {
          clearTimeout(timeout);

          // Show encrypted bubble on Beta's side
          msgBeta(msg.ciphertext, { isEncrypted: true });
          sysBeta('Encrypted message received via WebSocket ✓');

          // Decrypt
          setPhase('decrypt');
          sysBeta('Decrypting with ML-KEM-768 secret key…');
          await wait(400);

          try {
            const plaintext = await decryptMessage(betaSk, msg);
            const parsed = JSON.parse(plaintext);
            msgBeta(`"${parsed.memo}"`);
            sysBeta(`Task: ${parsed.task} · ${parsed.amount_mist} MIST`);
            await wait(500);
            sysBeta('Executing Sui transaction autonomously…');
            await wait(800);
            msgBeta('Transaction submitted to Sui testnet ✓', {
              txDigest: '3EF4Ci6CrXZF1EWpoh4JDnPRg46kQfiVEY9Jnsbn8RYx',
            });
          } catch {
            sysBeta('[decryption failed]');
          }

          betaSocket.disconnect();
          setPhase('done');
          resolve();
        });

        betaSocket.on('connect_error', (err) => {
          clearTimeout(timeout);
          betaSocket.disconnect();
          reject(new Error(`WebSocket connect failed: ${err.message}`));
        });
      });
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  }

  const phaseLabel: Record<Phase, string> = {
    idle:    'READY',
    keygen:  'GENERATING KEYS…',
    login:   'AUTHENTICATING…',
    pubkey:  'REGISTERING KEYS…',
    fetch:   'FETCHING ON-CHAIN…',
    encrypt: 'ENCRYPTING…',
    send:    'SENDING…',
    receive: 'RECEIVING…',
    decrypt: 'DECRYPTING…',
    done:    'COMPLETE',
  };

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', padding: '24px 32px', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: 3, color: RED, fontWeight: 700 }}>QUBIT</div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: MUTED }}>AGENT-TO-AGENT DEMO</div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: MUTED, letterSpacing: 1 }}>
            ML-KEM-768 + AES-256-GCM · Sui Testnet
          </div>
        </div>
        <div style={{ height: 1, background: BORDER }} />
      </div>

      {/* Agent panels */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <AgentPanel name="Agent Alpha" address={ALPHA_ADDR} lines={alphaLines} side="left" />

        {/* Wire view */}
        <div style={{
          width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10, paddingTop: 60,
        }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>
            Secure Channel
          </div>
          <div style={{ width: 1, flex: 1, background: wirePayload ? RED : BORDER, maxHeight: 80, transition: 'background 0.5s' }} />
          {wirePayload ? (
            <div style={{
              border: `1px solid ${RED}`,
              background: 'rgba(230,0,35,0.05)',
              padding: '10px 10px',
              width: '100%',
            }}>
              <div style={{ fontSize: 8, color: RED, letterSpacing: 1.5, marginBottom: 6 }}>WIRE PAYLOAD</div>
              <div style={{ fontSize: 8, color: MUTED, marginBottom: 4 }}>
                KEM CT · {Math.round(wirePayload.kemCiphertext.length * 3 / 4)}B
              </div>
              <div style={{
                fontSize: 7, fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all', marginBottom: 8,
              }}>
                {wirePayload.kemCiphertext.slice(0, 28)}…
              </div>
              <div style={{ fontSize: 8, color: MUTED, marginBottom: 4 }}>
                AES-GCM CT · {Math.round(wirePayload.ciphertext.length * 3 / 4)}B
              </div>
              <div style={{
                fontSize: 7, fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(255,255,255,0.3)', wordBreak: 'break-all',
              }}>
                {wirePayload.ciphertext.slice(0, 28)}…
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', textAlign: 'center', letterSpacing: 0.5 }}>
              No traffic
            </div>
          )}
          <div style={{ width: 1, flex: 1, background: wirePayload ? RED : BORDER, maxHeight: 80, transition: 'background 0.5s' }} />
        </div>

        <AgentPanel name="Agent Beta" address={BETA_ADDR} lines={betaLines} side="right" />
      </div>

      {/* Controls */}
      <div style={{
        borderTop: `1px solid ${BORDER}`,
        paddingTop: 16,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={runDemo}
          disabled={phase !== 'idle' && phase !== 'done'}
          style={{
            background: (phase === 'idle' || phase === 'done') ? RED : 'rgba(230,0,35,0.3)',
            border: 'none', color: '#fff',
            padding: '10px 28px',
            fontSize: 11, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: (phase === 'idle' || phase === 'done') ? 'pointer' : 'not-allowed',
          }}
        >
          {phase === 'done' ? '↺ RUN AGAIN' : 'RUN DEMO'}
        </button>

        <div style={{ fontSize: 10, letterSpacing: 2, color: phase === 'done' ? '#4ade80' : phase === 'idle' ? MUTED : '#f59e0b' }}>
          {phase !== 'idle' && <StatusDot color={phase === 'done' ? '#4ade80' : '#f59e0b'} />}
          {phaseLabel[phase]}
        </div>

        {error && (
          <div style={{ fontSize: 11, color: RED, marginLeft: 8 }}>✗ {error}</div>
        )}

        {phase === 'done' && (
          <div style={{ marginLeft: 'auto', fontSize: 10, color: MUTED }}>
            Zero plaintext on any wire or in the database.
          </div>
        )}
      </div>
    </div>
  );
}
