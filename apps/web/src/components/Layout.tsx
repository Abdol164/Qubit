import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDisconnectWallet, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAuthStore } from '../store/authStore';
import { AddressDisplay } from './AddressDisplay';
import { ConnectionDot } from './ConnectionDot';
import { isRegistered, buildRegisterTx } from '../lib/sui/registry';
import { api } from '../lib/api/client';
import { loadKeypairFromStorage, generateMLKEMKeypair, saveKeypairToStorage } from '../lib/crypto/keygen';

interface Props {
  children: React.ReactNode;
  isConnected?: boolean;
}

export function Layout({ children, isConnected = false }: Props) {
  const address = useAuthStore((s) => s.address);
  const mlkemPk = useAuthStore((s) => s.mlkemPk);
  const logout = useAuthStore((s) => s.logout);
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const navigate = useNavigate();
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!address) return;

    async function syncKey() {
      // Load keypair from storage (or generate fresh if missing)
      let kp = loadKeypairFromStorage();
      if (!kp) {
        kp = await generateMLKEMKeypair();
        saveKeypairToStorage(kp.pk, kp.sk);
      }

      const pkBase64 = btoa(String.fromCharCode(...Array.from(kp.pk)));
      console.log('[Layout] pushing pubkey to backend, length:', kp.pk.length);

      try {
        await api.put('/users/pubkey', { pubKey: pkBase64 });
        console.log('[Layout] pubkey stored in backend');
      } catch (err) {
        console.error('[Layout] failed to store pubkey:', err);
      }

      const reg = await isRegistered(address!).catch(() => false);
      setRegistered(reg);
    }

    syncKey();
  }, [address]);

  async function handleRegister() {
    if (!mlkemPk || registering) return;
    setRegistering(true);
    try {
      const tx = buildRegisterTx(mlkemPk);
      await signAndExecuteTransaction({ transaction: tx });
      setRegistered(true);
    } catch {
      // user rejected or tx failed — stay unregistered
    } finally {
      setRegistering(false);
    }
  }

  function handleLogout() {
    disconnectWallet();
    logout();
    navigate({ to: '/login' });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Registration banner */}
      {registered === false && (
        <div
          style={{
            background: '#E60023',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            Your ML-KEM-768 key is not on-chain — agents cannot reach you yet
          </span>
          <button
            onClick={handleRegister}
            disabled={registering}
            style={{
              background: 'white',
              border: 'none',
              color: '#E60023',
              padding: '4px 14px',
              cursor: registering ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              opacity: registering ? 0.6 : 1,
            }}
          >
            {registering ? 'REGISTERING…' : 'REGISTER KEY'}
          </button>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          borderBottom: '2px solid white',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: '#0a0a0a',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <span
          className="mono"
          style={{ fontWeight: 700, fontSize: 18, letterSpacing: 2, textTransform: 'uppercase' }}
        >
          QUBIT
        </span>

        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            border: '1px solid #E60023',
            color: '#E60023',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          AGENTIC WEB PROTOCOL
        </span>

        <div style={{ flex: 1 }} />

        {address && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ConnectionDot connected={isConnected} />
            <AddressDisplay address={address} />
          </span>
        )}

        {address && (
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.7)',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            LOGOUT
          </button>
        )}
      </header>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
    </div>
  );
}
