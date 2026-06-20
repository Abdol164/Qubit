import { useState } from 'react';
import { useNicknames } from '../hooks/useNicknames';

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  address: string;
  editable?: boolean;
}

export function AddressDisplay({ address, editable = false }: Props) {
  const { getNickname, setNickname } = useNicknames();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const nickname = getNickname(address);

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setNickname(address, draft.trim()); setEditing(false); }
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="Set nickname…"
          style={{
            background: 'transparent',
            border: '1px solid white',
            color: 'white',
            padding: '2px 6px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        />
        <button
          onClick={() => { setNickname(address, draft.trim()); setEditing(false); }}
          style={{ background: '#E60023', border: 'none', color: 'white', padding: '2px 6px', cursor: 'pointer', fontSize: 11 }}
        >
          OK
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {nickname ? (
        <span>{nickname}</span>
      ) : (
        <span className="mono" title={address} style={{ fontSize: '0.85em' }}>
          {truncate(address)}
        </span>
      )}
      {editable && (
        <button
          onClick={() => { setDraft(nickname ?? ''); setEditing(true); }}
          title="Set nickname"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 12,
          }}
        >
          ✎
        </button>
      )}
    </span>
  );
}
