import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { useAuthStore } from '../store/authStore';
import { generateMLKEMKeypair, saveKeypairToStorage, loadKeypairFromStorage } from '../lib/crypto/keygen';
import { isRegistered, buildRegisterTx } from '../lib/sui/registry';
import { api } from '../lib/api/client';

type Step = 'connect' | 'signing' | 'registering' | 'done' | 'error';

// Module-level flag — survives React StrictMode unmount/remount cycles
// so signPersonalMessage is never called twice for the same account connect.
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
      loginInFlight = false; // wallet disconnected — allow fresh login
      return;
    }
    if (loginInFlight) return;
    loginInFlight = true;

    async function doLogin() {
      try {
        const address = account!.address;

        // 1. Get a fresh HMAC-signed nonce for this address
        setStep('signing');
        const { nonce } = await api.get(`/auth/nonce?address=${address}`);

        // 2. Exchange address + nonce for JWT (HMAC proves freshness)
        const { access_token } = await api.post('/auth/login', { address, nonce });
        login(address, access_token);

        // 4. ML-KEM keypair
        let keypair = loadKeypairFromStorage();
        if (!keypair) {
          keypair = await generateMLKEMKeypair();
          saveKeypairToStorage(keypair.pk, keypair.sk);
        }
        setKeypair(keypair.pk, keypair.sk);

        // 5. Always store public key in backend (works even without wallet signing)
        const pkBase64 = btoa(String.fromCharCode(...keypair.pk));
        await api.put('/users/pubkey', { pubKey: pkBase64 });

        // 6. Also try to register on-chain (best-effort — requires wallet signing)
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
    connect: 'Connect your Sui wallet to continue',
    signing: 'Authenticating…',
    registering: 'Registering ML-KEM public key on-chain…',
    done: 'Redirecting…',
    error: 'Authentication failed',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 480,
          border: '2px solid white',
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Logo */}
        <div>
          <div
            className="mono"
            style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}
          >
            QUBIT
          </div>
          <div style={{ color: '#E60023', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
            POST-QUANTUM AGENT COMMUNICATION LAYER
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }} />

        {/* Wallet connect */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}
          >
            WALLET LOGIN
          </div>
          <ConnectButton />
        </div>

        {/* Status */}
        <div style={{ fontSize: 13, color: step === 'error' ? '#E60023' : 'rgba(255,255,255,0.6)', minHeight: 18 }}>
          {error ?? stepLabel[step]}
        </div>

        {/* What happens */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 16 }}>
          <div
            style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}
          >
            HOW IT WORKS
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Connect wallet — your Sui address is your agent identity',
              'ML-KEM-768 keypair generated locally (NIST FIPS 203)',
              'Public key registered on-chain — any agent can look it up',
              'Instructions encrypted end-to-end — server stores only ciphertext',
              'Quantum-resistant by default — secure against future adversaries',
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
