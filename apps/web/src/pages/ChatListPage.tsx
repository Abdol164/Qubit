import { useState } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { Layout } from '../components/Layout';
import { AddressDisplay } from '../components/AddressDisplay';

const CONTACTS_KEY = 'qubit_contacts';

function loadContacts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveContacts(contacts: string[]) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

function isSuiAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

export function ChatListPage() {
  const [contacts, setContacts] = useState<string[]>(loadContacts);
  const [newAddress, setNewAddress] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const navigate = useNavigate();

  function addContact() {
    const addr = newAddress.trim();
    if (!isSuiAddress(addr)) {
      setInputError('Enter a valid Sui address (0x + 64 hex chars)');
      return;
    }
    if (!contacts.includes(addr)) {
      const next = [addr, ...contacts];
      setContacts(next);
      saveContacts(next);
    }
    setNewAddress('');
    setInputError(null);
    navigate({ to: '/chat/$address', params: { address: addr } });
  }

  return (
    <Layout>
      <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}
          >
            SECURE CHANNELS
          </div>
        </div>

        {/* New chat input */}
        <div style={{ border: '2px solid white', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            NEW CHANNEL
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newAddress}
              onChange={(e) => { setNewAddress(e.target.value); setInputError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && addContact()}
              placeholder="0x… Sui address"
              className="mono"
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '8px 12px',
                fontSize: 13,
              }}
            />
            <button
              onClick={addContact}
              style={{
                background: '#E60023',
                border: 'none',
                color: 'white',
                padding: '8px 20px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              GO
            </button>
          </div>
          {inputError && (
            <div style={{ color: '#E60023', fontSize: 12 }}>{inputError}</div>
          )}
        </div>

        {/* Contact list */}
        {contacts.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
            No channels open — enter a Sui address above to open a post-quantum encrypted channel.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {contacts.map((addr) => (
              <Link
                key={addr}
                to="/chat/$address"
                params={{ address: addr }}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <AddressDisplay address={addr} editable />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
