import { Link } from '@tanstack/react-router';
import { useAuthStore } from '../store/authStore';

const RED   = '#E60023';
const BG    = '#0a0a0a';
const SURF  = '#111111';
const SURFLO = '#0d0d0d';
const BORDER = 'rgba(255,255,255,0.12)';
const BORDERHI = 'rgba(255,255,255,0.25)';
const MUTED  = 'rgba(255,255,255,0.45)';

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>;
}

export function LandingPage() {
  const token = useAuthStore((s) => s.token);

  return (
    <div style={{ background: BG, color: '#fff', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 50,
        background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(12px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 32px', height: 64,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div className="mono" style={{ fontWeight: 700, fontSize: 14, letterSpacing: 4, textTransform: 'uppercase' }}>
          QUBIT_SYSTEM
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: RED, borderBottom: `2px solid ${RED}`, paddingBottom: 4 }}>
            PROTOCOL
          </span>
          {['RESEARCH', 'SECURITY', 'DOCS'].map(label => (
            <a key={label} href="#" className="mono" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: MUTED, textDecoration: 'none' }}>
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link to={token ? '/chat' : '/login'}>
            <button className="mono" style={{
              background: RED, color: '#fff', border: 'none',
              padding: '8px 18px', cursor: 'pointer',
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
            }}>
              {token ? 'OPEN APP' : 'INITIALIZE_NODE'}
            </button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <header style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 128, overflow: 'hidden' }}>
        {/* grid lines */}
        {[{left:32},{right:32}].map((pos,i) => (
          <div key={i} style={{ position:'absolute', top:0, bottom:0, width:1, background: BORDER, zIndex:0, ...pos }} />
        ))}
        <div style={{ position:'absolute', left:0, right:0, top:128, height:1, background: BORDER }} />

        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 10,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 64, paddingTop: 64, paddingBottom: 64,
        }}>
          {/* Left */}
          <div style={{ flex: '1 1 500px', borderRight: `1px solid ${BORDER}`, paddingRight: 64, paddingTop: 32, paddingBottom: 32 }}>
            <div style={{ display: 'inline-block', border: `1px solid ${RED}`, padding: '4px 10px', marginBottom: 24 }}>
              <span className="mono" style={{ fontSize: 10, color: RED, letterSpacing: 3, textTransform: 'uppercase' }}>
                VERSION 1.0.4-BETA // NETWORK: SUI_TESTNET
              </span>
            </div>
            <h1 className="display" style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24 }}>
              The first post-quantum<br/><span style={{ color: RED }}>key registry</span> on Sui.
            </h1>
            <p style={{ fontSize: 17, color: MUTED, maxWidth: 520, marginBottom: 32, lineHeight: 1.6 }}>
              The infrastructure for secure agentic coordination in the quantum era. Deploy, discover, and transmit encrypted data between AI agents with ML-KEM-768 precision.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Link to={token ? '/chat' : '/login'}>
                <button className="mono" style={{
                  background: RED, color: '#fff', border: 'none',
                  padding: '14px 32px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 11, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {token ? 'OPEN APP' : 'LAUNCH APP'} <Icon name="arrow_forward" style={{ fontSize: 18 }} />
                </button>
              </Link>
              <a href="https://github.com" target="_blank" rel="noreferrer">
                <button className="mono" style={{
                  background: 'transparent', color: '#fff',
                  border: `1px solid ${BORDERHI}`, padding: '14px 32px', cursor: 'pointer',
                  fontSize: 11, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase',
                }}>
                  VIEW ON GITHUB
                </button>
              </a>
              <button className="mono" style={{
                background: 'transparent', color: MUTED, border: 'none',
                padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              }}>
                WATCH DEMO <Icon name="play_circle" style={{ fontSize: 18 }} />
              </button>
            </div>
          </div>

          {/* Right — status panel */}
          <div style={{ flex: '1 1 280px', position: 'relative', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,17,17,0.2)', border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              <div className="scanline" />
            </div>
            <div className="mono" style={{
              position: 'relative', zIndex: 10,
              background: BG, border: `1px solid ${BORDERHI}`,
              padding: 24, width: '100%', maxWidth: 320, fontSize: 12,
            }}>
              {[['SYSTEM_LOAD','0.003%'],['ENTROPY_POOL','ACTIVE'],['BLOCK_HEIGHT','84,932,103']].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', borderBottom:`1px solid ${BORDER}`, paddingBottom:8, marginBottom:8 }}>
                  <span style={{ color: RED }}>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ marginTop:16, height:80, background:SURF, border:`1px solid ${BORDER}`, display:'flex', alignItems:'flex-end', padding:8, gap:4 }}>
                {[50,66,80,33,75,100].map((h,i) => (
                  <div key={i} style={{ flex:1, height:`${h}%`, background: RED }} />
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:10, color: MUTED, textTransform:'uppercase', letterSpacing:3, fontWeight:700 }}>
                REALTIME_QUANTUM_THREAT_MONITOR
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── PROBLEM ─────────────────────────────────────────────────────── */}
      <section style={{ borderTop:`1px solid ${BORDER}`, borderBottom:`1px solid ${BORDER}`, background: SURFLO, padding: '80px 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 32px', display:'flex', flexWrap:'wrap', gap:48, alignItems:'center' }}>

          <div style={{ flex:'1 1 340px' }}>
            <h2 className="mono" style={{ fontSize:10, color: RED, letterSpacing:4, textTransform:'uppercase', marginBottom:16 }}>[THREAT_ADVISORY]</h2>
            <h3 className="display" style={{ fontSize:'clamp(22px,3vw,32px)', fontWeight:700, textTransform:'uppercase', lineHeight:1.2, marginBottom:24 }}>
              Quantum Computing:<br/>The Agentic Ticking Time Bomb.
            </h3>
            <p style={{ fontSize:15, color: MUTED, lineHeight:1.7, marginBottom:24 }}>
              Today's AI agents on Sui communicate in plain text or with classical asymmetric encryption.
              Retroactive quantum decryption makes every sensitive message shared between agents today
              permanently vulnerable in the near future.
            </p>
            <div style={{ borderLeft:`2px solid ${RED}`, padding:'12px 16px', background:'rgba(230,0,35,0.08)' }}>
              <p className="mono" style={{ fontSize:11, color: RED, letterSpacing:2, textTransform:'uppercase', lineHeight:1.6 }}>
                CRITICAL: Harvest Now, Decrypt Later (HNDL) attacks are targeting cross-chain agentic workflows.
              </p>
            </div>
          </div>

          <div style={{ flex:'1 1 400px' }}>
            <div style={{ border:`1px solid ${BORDER}`, background:'#000', position:'relative', aspectRatio:'16/9', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvaWwdP65DGdgW-8xiVajgi1KO5bxr6ByF07QoQqeF0ygS67Ml7374fA8vXY8RExM2QICOTXf1o2XSCQ2uQ1fsU9Ew2DQM1hhVXwyMowL36TU9tWK3KqB6Fr9Kplp9LwQO5C30OViBnPjscZ_NK8knXK3zY8D0jD-3Y908PZgffCKONoUMd_2ylAP3dy3wbByLt6Jk7c1-Y5EQCIXHia1v4YL8fJeSLNVEwyz6SaeGMUt_s3EiTYpBKZ05kZeL5OPkouioQ8sqZASr"
                alt="Quantum processor"
                style={{ width:'100%', height:'100%', objectFit:'cover', filter:'grayscale(1) brightness(0.45)' }}
              />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, #0a0a0a 0%, transparent 60%)' }} />
              <div style={{
                position:'absolute', bottom:16, left:16, right:16,
                background:'rgba(10,10,10,0.9)', border:`1px solid ${BORDER}`,
                padding:'12px 16px', display:'flex', alignItems:'center', gap:12,
              }}>
                <Icon name="warning" style={{ color: RED, fontSize:20, fontVariationSettings:"'FILL' 1" }} />
                <span className="mono" style={{ fontSize:11, textTransform:'uppercase', letterSpacing:2 }}>Vulnerability detected: RSA-2048 / ECC-256</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── SOLUTION ────────────────────────────────────────────────────── */}
      <section style={{ padding:'80px 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 32px' }}>
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'flex-end', gap:24, marginBottom:40 }}>
            <div>
              <h2 className="mono" style={{ fontSize:10, color: RED, letterSpacing:4, textTransform:'uppercase', marginBottom:12 }}>[RESOLUTION]</h2>
              <h3 className="display" style={{ fontSize:'clamp(22px,3vw,32px)', fontWeight:700, textTransform:'uppercase' }}>Post-Quantum Security Layer.</h3>
            </div>
            <span className="mono" style={{ fontSize:11, color: MUTED }}>SUI_OBJECT_ID: 0xQUB1T...768</span>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', border:`1px solid ${BORDER}` }}>
            {[
              { icon:'lock',     label:'ML-KEM-768 Encryption',  body:"Standardized lattice-based cryptography that resists Shor's algorithm and future quantum adversaries." },
              { icon:'database', label:'On-chain Key Registry',   body:'Immutable registry for PQC public keys, allowing agents to verify identities without centralized authorities.' },
              { icon:'hub',      label:'Secure A2A Messaging',    body:'Move-based encrypted communication channels optimized for low-latency agentic coordination.' },
            ].map(({ icon, label, body }, i, arr) => (
              <div key={label} style={{ padding:32, borderRight: i < arr.length-1 ? `1px solid ${BORDER}` : 'none' }}>
                <Icon name={icon} style={{ fontSize:36, color: RED, display:'block', marginBottom:20 }} />
                <h4 className="display" style={{ fontSize:15, fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>{label}</h4>
                <p style={{ fontSize:14, color: MUTED, lineHeight:1.7 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section style={{ background: SURFLO, padding:'80px 0', borderTop:`1px solid ${BORDER}`, borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 32px' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <h3 className="display" style={{ fontSize:'clamp(36px,5vw,64px)', fontWeight:700, textTransform:'uppercase', letterSpacing:'-0.02em' }}>How It Works</h3>
            <p className="mono" style={{ fontSize:10, color: MUTED, textTransform:'uppercase', letterSpacing:6, marginTop:12 }}>PROTOCOL_SEQUENCE_O1–O3</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24 }}>
            {[
              { n:'01', tag:'REGISTRY_ANCHOR', title:'Anchor Public Key',   body:'The initiator agent generates a PQC keypair and anchors the public component to a Sui Move contract, creating a verifiable on-chain identity.', cmd:'CMD: qubit register --key ./pqc.pub' },
              { n:'02', tag:'P2P_DISCOVERY',   title:'Fetch Recipient Key', body:"The recipient agent queries the Sui blockchain to fetch the sender's authenticated PQC public key from the global registry.",                  cmd:'QUERY: qubit lookup --address 0x...' },
              { n:'03', tag:'TUNNEL_INIT',     title:'Establish Channel',   body:'Both agents run ML-KEM-768 key encapsulation to derive a shared AES-256-GCM secret. The server never sees plaintext.',                          cmd:'STATUS: CHANNEL_SECURED_PQC' },
            ].map(({ n, tag, title, body, cmd }) => (
              <div key={n} style={{ position:'relative' }}>
                <div className="display" style={{
                  position:'absolute', top:-32, left:-8,
                  fontSize:120, fontWeight:900, lineHeight:1,
                  color:'rgba(255,255,255,0.04)', pointerEvents:'none', userSelect:'none', zIndex:0,
                }}>
                  {n}
                </div>
                <div style={{ position:'relative', zIndex:1, background: BG, border:`1px solid ${BORDER}`, padding:32 }}>
                  <h5 className="mono" style={{ fontSize:10, color: RED, letterSpacing:4, textTransform:'uppercase', marginBottom:12 }}>{tag}</h5>
                  <h4 className="display" style={{ fontSize:15, fontWeight:700, textTransform:'uppercase', marginBottom:16 }}>{title}</h4>
                  <p style={{ fontSize:14, color: MUTED, lineHeight:1.7 }}>{body}</p>
                  <div style={{ marginTop:20, paddingTop:16, borderTop:`1px solid ${BORDER}` }}>
                    <span className="mono" style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>{cmd}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH SPECS ──────────────────────────────────────────────────── */}
      <section style={{ padding:'80px 0' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 32px' }}>
          <div style={{ border:'2px solid white', padding:40, background: BG }}>
            <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:24, marginBottom:40 }}>
              <h3 className="display" style={{ fontSize:'clamp(20px,2.5vw,28px)', fontWeight:700, textTransform:'uppercase' }}>Technical Specs</h3>
              <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                {[
                  { label:'MOVE_CONTRACT', style:{ border:`2px solid ${RED}`, color: RED } },
                  { label:'AES-256-GCM',   style:{ border:`1px solid ${BORDER}`, color: MUTED } },
                  { label:'ML-KEM-768',    style:{ border:`1px solid ${BORDER}`, color: MUTED } },
                  { label:'TESTNET_LIVE',  style:{ background: RED, color:'#fff' } },
                ].map(({ label, style }) => (
                  <span key={label} className="mono" style={{ padding:'4px 12px', fontSize:10, letterSpacing:3, textTransform:'uppercase', ...style }}>{label}</span>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:32 }}>
              {[['Throughput','120K TPS'],['Latency','< 400MS'],['Key Size','1184 BYTES'],['Consensus','MYSTICETI']].map(([label, value]) => (
                <div key={label} style={{ borderLeft:`2px solid ${RED}`, paddingLeft:16 }}>
                  <div className="mono" style={{ fontSize:10, color: MUTED, textTransform:'uppercase', letterSpacing:3, marginBottom:8 }}>{label}</div>
                  <div className="display" style={{ fontSize:'clamp(18px,2vw,24px)', fontWeight:700 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AGENTIC WEB ─────────────────────────────────────────────────── */}
      <section style={{ padding:'80px 0', background: BG }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 32px' }}>
          <div style={{ position:'relative', border:'2px solid white', padding:64, display:'flex', flexWrap:'wrap', alignItems:'center', gap:48 }}>
            {/* corner accents */}
            <div style={{ position:'absolute', top:0, right:0, width:80, height:80, background:'rgba(230,0,35,0.08)', borderBottom:`2px solid ${RED}`, borderLeft:`2px solid ${RED}` }} />
            <div style={{ position:'absolute', bottom:0, left:0, width:52, height:52, background:'rgba(230,0,35,0.08)', borderTop:`2px solid ${RED}`, borderRight:`2px solid ${RED}` }} />

            <div style={{ flex:'1 1 380px', position:'relative', zIndex:1 }}>
              <h3 className="display" style={{ fontSize:'clamp(28px,4vw,48px)', fontWeight:700, textTransform:'uppercase', lineHeight:1.15, letterSpacing:'-0.02em', marginBottom:24 }}>
                Security is Not an Afterthought.
              </h3>
              <p style={{ fontSize:16, color: MUTED, lineHeight:1.7, marginBottom:24 }}>
                We are building the HTTP of the agentic web. As AI agents move from simple tools to autonomous economic actors on Sui, Qubit provides the fundamental trust layer required for secure coordination.
              </p>
              <div style={{ borderLeft:`2px solid ${RED}`, paddingLeft:16 }}>
                <p className="mono" style={{ fontSize:13, color: RED, lineHeight:1.7 }}>
                  "Without post-quantum security, decentralized AI is a house built on sand. Qubit provides the bedrock."
                </p>
              </div>
            </div>

            <div style={{ flex:'1 1 280px', display:'flex', justifyContent:'center' }}>
              <div style={{ position:'relative' }}>
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAV31VHF71nl9tlf4s1ObN0A6eiVtvtq_BWpEYrZ2tzYEPBKQZo1aMJ8IvCVRyf5na3Q2x83Ztd2XVAvjukm0SaTivONkoEsOOif0mOLbs-MMhSjpoIpnQeWiYSR5Q2q0TcZd9w9aIQ-aP7C1NHui7PzC7Fm9nk-B3U6zI1PPHVUIFwiwKvG8Nq5ebu_SrMFeAJpeEq7Qjr36Qx3H3KSuEj0ACoK4o3FLONKIItxjWBXUVMJymsmnMAeiHd6LsE5BJ6GUYr2My6C7B8"
                  alt="Agent network"
                  style={{ width:288, height:288, objectFit:'cover', filter:'grayscale(1) brightness(0.35)', border:`1px solid ${BORDER}`, display:'block' }}
                />
                <div style={{ position:'absolute', inset:0, background:'rgba(230,0,35,0.08)' }} />
                <div style={{ position:'absolute', inset:-8, border:`1px solid rgba(230,0,35,0.3)` }} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ padding:'40px 32px', display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'flex-start', gap:32, borderTop:'2px solid white', background: BG }}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="mono" style={{ fontSize:12, fontWeight:700, letterSpacing:4, textTransform:'uppercase' }}>QUBIT_PROTOCOLS</div>
          <p className="mono" style={{ fontSize:11, color: MUTED, maxWidth:300, lineHeight:1.6 }}>
            © 2026 QUBIT_PROTOCOLS // SUI_NETWORK_INFRASTRUCTURE
          </p>
          <p className="mono" style={{ fontSize:10, color: RED, letterSpacing:2, textTransform:'uppercase', lineHeight:1.6 }}>
            "Qubit deploys the first post-quantum key registry on Sui —<br/>any agent can build on top of it."
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:48 }}>
          {[
            { heading:'SOURCE',    links:['github_repo','sui_explorer'] },
            { heading:'RESOURCES', links:['documentation','white_paper'] },
            { heading:'COMMUNITY', links:['discord_ops','ecosystem_portal'] },
            { heading:'EVENTS',    links:['sui_overflow_2026'] },
          ].map(({ heading, links }) => (
            <div key={heading} style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <span className="mono" style={{ fontSize:10, color: MUTED, textTransform:'uppercase', letterSpacing:3, marginBottom:4, opacity:0.6 }}>{heading}</span>
              {links.map(link => (
                <a key={link} href="#" className="mono" style={{ fontSize:11, textDecoration:'none', color: link.includes('overflow') ? RED : MUTED, textTransform: link.includes('overflow') ? 'uppercase' : 'lowercase', letterSpacing: link.includes('overflow') ? 2 : 0 }}>
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
      </footer>

    </div>
  );
}
