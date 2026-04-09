import type { EnvStatus } from '../lib/envCheck';

interface Props {
  status: EnvStatus;
}

export default function EnvErrorPage({ status }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', background: '#080C18', padding: '2rem', gap: '1.5rem',
    }}>
      <div style={{ fontSize: '2.5rem' }}>⚙️</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#F1F5F9', textAlign: 'center' }}>
        Configuration Required
      </div>
      <div style={{
        background: '#0C1220', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px',
        padding: '1.5rem', maxWidth: '520px', width: '100%',
      }}>
        <div style={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600, marginBottom: '0.75rem' }}>
          Missing required environment variables:
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {status.missing.map(name => (
            <li key={name} style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{name}</li>
          ))}
        </ul>
        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1rem' }}>
          Open <code style={{ color: '#38BDF8', background: 'rgba(56,189,248,0.08)', padding: '1px 5px', borderRadius: '4px' }}>.env.local</code> in
          the project root and fill in the real values from your Supabase dashboard
          (Settings → API → <em>anon public</em> key).
        </div>
      </div>
      {status.warnings.length > 0 && (
        <div style={{
          background: '#0C1220', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px',
          padding: '1.25rem', maxWidth: '520px', width: '100%',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 600, marginBottom: '0.5rem' }}>
            Optional keys not configured (some features will be limited):
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {status.warnings.map(name => (
              <li key={name} style={{ fontSize: '0.75rem', color: '#64748B' }}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
