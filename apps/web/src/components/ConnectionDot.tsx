interface Props {
  connected: boolean;
}

export function ConnectionDot({ connected }: Props) {
  return (
    <span
      title={connected ? 'Connected' : 'Disconnected'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        background: connected ? '#00cc44' : '#E60023',
        border: '1px solid rgba(255,255,255,0.3)',
        flexShrink: 0,
      }}
    />
  );
}
