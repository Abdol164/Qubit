import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { useAuthStore } from '../store/authStore';
import { generateMLKEMKeypair, saveKeypairToStorage, loadKeypairFromStorage } from '../lib/crypto/keygen';
import { isRegistered, buildRegisterTx } from '../lib/sui/registry';
import { api } from '../lib/api/client';

type Step = 'connect' | 'signing' | 'registering' | 'done' | 'error';

let loginInFlight = false;

export function LoginPage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const login = useAuthStore((s) => s.login);
  const setKeypair = useAuthStore((s) => s.setKeypair);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('connect');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) { navigate({ to: '/chat' }); return; }
  }, [token, navigate]);

  useEffect(() => {
    if (!account) {
      loginInFlight = false;
      return;
    }
    if (loginInFlight) return;
    loginInFlight = true;

    async function doLogin() {
      try {
        const address = account!.address;

        setStep('signing');
        const { nonce } = await api.get(`/auth/nonce?address=${address}`);

        const { access_token } = await api.post('/auth/login', { address, nonce });
        login(address, access_token);

        let keypair = loadKeypairFromStorage();
        if (!keypair) {
          keypair = await generateMLKEMKeypair();
          saveKeypairToStorage(keypair.pk, keypair.sk);
        }
        setKeypair(keypair.pk, keypair.sk);

        const pkBase64 = btoa(String.fromCharCode(...keypair.pk));
        await api.put('/users/pubkey', { pubKey: pkBase64 });

        try {
          const registered = await isRegistered(address);
          if (!registered) {
            setStep('registering');
            const tx = buildRegisterTx(keypair.pk);
            await signAndExecuteTransaction({ transaction: tx });
          }
        } catch {
          // On-chain registration failed — backend key is the fallback
        }

        setStep('done');
        navigate({ to: '/chat' });
      } catch (err) {
        setStep('error');
        setError(err instanceof Error ? err.message : String(err));
        loginInFlight = false;
      }
    }

    doLogin();
  }, [account]);

  const stepLabel: Record<Step, string> = {
    connect: 'Connect your Sui wallet to initialise your agent identity',
    signing: 'Authenticating agent…',
    registering: 'Broadcasting ML-KEM public key to Sui network…',
    done: 'Identity confirmed. Redirecting…',
    error: 'Authentication failed',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 480,
        border: '2px solid white',
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Logo */}
        <div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}>
            QUBIT
          </div>
          <div style={{ color: '#E60023', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
            POST QUANTUM AGENT COMMUNICATION LAYER
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }} />

        {/* Demo links */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
            LIVE DEMO · NO WALLET REQUIRED
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              to="/demo"
              style={{
                display: 'block', padding: '11px 14px',
                border: '1px solid #E60023',
                color: '#E60023', fontSize: 11, fontWeight: 700,
                letterSpacing: 2, textTransform: 'uppercase',
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              ▶ WATCH AGENTS COMMUNICATE
            </Link>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                to="/agent/$role"
                params={{ role: 'alpha' }}
                style={{
                  flex: 1, display: 'block', padding: '9px 0',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 10,
                  fontWeight: 700, letterSpacing: 1.5,
                  textDecoration: 'none', textAlign: 'center',
                }}
              >
                AGENT α · SENDER
              </Link>
              <Link
                to="/agent/$role"
                params={{ role: 'beta' }}
                style={{
                  flex: 1, display: 'block', padding: '9px 0',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 10,
                  fontWeight: 700, letterSpacing: 1.5,
                  textDecoration: 'none', textAlign: 'center',
                }}
              >
                AGENT β · RECEIVER
              </Link>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }} />

        {/* Wallet connect */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            AGENT LOGIN
          </div>
          <ConnectButton />
        </div>

        {/* Status */}
        <div style={{ fontSize: 13, color: step === 'error' ? '#E60023' : 'rgba(255,255,255,0.6)', minHeight: 18 }}>
          {error ?? stepLabel[step]}
        </div>

        {/* How it works */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            HOW IT WORKS
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Connect wallet · your Sui address becomes your agent identity',
              'ML KEM 768 keypair generated locally in your browser',
              'Public key registered onchain · any agent can discover you',
              'Instructions encrypted end to end · server stores ciphertext only',
              'Quantum resistant by default · secure against future adversaries',
            ].map((text, i) => (
              <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                {text}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
