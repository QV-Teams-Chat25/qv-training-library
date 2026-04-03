import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getProcess } from '../../apiService';

const legalLine1 = 'Copyright © 2026 Quality Voices LLC. All rights reserved. Confidential and proprietary information for authorized business use only.';
const legalLine2 = 'IT Legal Notice: Unauthorized access, use, disclosure, copying, or distribution is prohibited and may result in disciplinary action, civil liability, and criminal penalties.';
const syncErrorSuffix = ' Sync Error';
type ProcessEntry = {
  title: string;
  content: string;
};

const normalizeRenderedHtml = (html: string) => {
  if (!html) {
    return '';
  }
  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
};

const getProcessButtonTitle = (html: string, fallback: string) => {
  const cleaned = normalizeRenderedHtml(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }
  const firstChunk = cleaned.split(/[.!?\n]/)[0] || cleaned;
  return firstChunk.slice(0, 40) || fallback;
};

const getVerificationEntries = (value: unknown): ProcessEntry[] => {
  if (typeof value === 'string') {
    const content = normalizeRenderedHtml(value);
    return content ? [{ title: 'Verification', content: value }] : [];
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ('title' in record || 'content' in record) {
      const title = typeof record.title === 'string' ? record.title : 'Verification';
      const content = typeof record.content === 'string' ? record.content : '';
      return normalizeRenderedHtml(content) ? [{ title, content }] : [];
    }
    return Object.keys(record)
      .map((key) => {
        const content = record[key];
        if (typeof content !== 'string' || !normalizeRenderedHtml(content)) {
          return null;
        }
        return { title: key, content };
      })
      .filter((entry): entry is ProcessEntry => entry !== null);
  }
  return [];
};

const AgentProcess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [liveProcess, setLiveProcess] = useState<Record<'Verification', unknown>>({ Verification: '' });
  const [scriptTitle, setScriptTitle] = useState('---');
  const [scriptContent, setScriptContent] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const refreshLiveProcess = async (cancelled = false) => {
    try {
      const data = await getProcess();
      const freshLive = {
        Verification: (data.live && typeof data.live === 'object' ? data.live.Verification : '') || '',
      };
      const entries = getVerificationEntries(freshLive.Verification);

      if (!cancelled) {
        if (entries.length === 0) {
          setLiveProcess({ Verification: '' });
          setScriptContent('');
          setScriptTitle('---');
          setActiveIndex(null);
        } else {
          setLiveProcess(freshLive);
          setScriptContent(entries[0].content || '');
          setScriptTitle(entries[0].title || 'Verification');
          setActiveIndex((current) => (current === null ? null : 0));
        }
        setSyncError(false);
      }
      return entries.length === 0 ? { Verification: '' } : freshLive;
    } catch {
      if (!cancelled) {
        setLiveProcess({ Verification: '' });
        setScriptContent('');
        setScriptTitle('---');
        setActiveIndex(null);
        setSyncError(true);
      }
      return { Verification: '' };
    }
  };

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const refreshNow = () => {
      void refreshLiveProcess(cancelled);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNow();
      }
    };

    refreshNow();
    intervalId = window.setInterval(refreshNow, 3000);
    window.addEventListener('focus', refreshNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', refreshNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.search]);

  const resolveHomePath = () => {
    const params = new URLSearchParams(location.search);
    if (params.get('role') === 'manager') {
      return '/managers';
    }
    const ref = document.referrer || '';
    const isManagerReferrer = ref.includes('/managers') || ref.includes('/#/manager') || ref.includes('/manager');
    return isManagerReferrer ? '/managers' : '/agents';
  };

  const handleBackHome = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const params = new URLSearchParams(location.search);
    const ref = document.referrer || '';
    const managerContext = params.get('role') === 'manager' || ref.includes('/managers') || ref.includes('/#/manager') || ref.includes('/manager');
    const fromManager = ref.includes('/managers') || ref.includes('/#/manager') || ref.includes('/manager');
    if (managerContext && fromManager && window.history.length > 1) {
      event.preventDefault();
      navigate(-1);
    }
  };

  const verificationEntries = getVerificationEntries(liveProcess.Verification);
  const activeEntry = activeIndex === null ? null : verificationEntries[activeIndex] || null;
  const activeHtml = activeEntry ? normalizeRenderedHtml(activeEntry.content) : normalizeRenderedHtml(scriptContent);
  const activeTitle = activeEntry ? (activeEntry.title || 'Verification') : (scriptTitle || 'Verification');
  const primaryEntry = verificationEntries[0] || null;
  const primaryLabel = primaryEntry ? (scriptTitle || 'Verification') : '---';
  const emptyStateMessage = 'No verification script currently published.';

  return (
    <div style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', background: '#f0f2f5', color: '#233044' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '20px', textAlign: 'center' }}>
        <h1>QV Training Library --- Verification</h1>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <section style={{ width: 'min(900px, 100%)', background: '#ffffff', borderRadius: '12px', boxShadow: '0 6px 22px rgba(0, 0, 0, 0.08)', padding: '28px' }}>
          <h2 style={{ marginTop: 0, color: '#003366' }}>Verification</h2>
          <p style={{ color: '#6a7380', marginBottom: '22px' }}>Select the verification button to open the published script.</p>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={async () => {
                const refreshed = await refreshLiveProcess();
                if (getVerificationEntries(refreshed.Verification).length > 0) {
                  setActiveIndex(0);
                }
              }}
              style={{ width: '100%', maxWidth: '560px', border: primaryEntry ? '1px solid #cbdcf2' : '1px dashed #d8deea', background: primaryEntry ? 'linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)' : '#f8fafc', color: primaryEntry ? '#13406f' : '#8a97ab', fontWeight: 700, fontSize: '20px', letterSpacing: '0.01em', borderRadius: '10px', padding: '18px 16px', cursor: 'pointer', minHeight: '76px', boxShadow: primaryEntry ? 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(16, 54, 92, 0.08)' : 'none', transition: 'background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease' }}
            >
              {primaryLabel}
            </button>
          </div>

          <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'center' }}>
            <Link to={resolveHomePath()} onClick={handleBackHome} style={{ background: '#1e67cc', color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '12px 18px', borderRadius: '8px', border: 'none' }}>
              Back to Home
            </Link>
          </div>
        </section>
      </main>

      {activeIndex !== null && (
        <div onClick={(event) => event.target === event.currentTarget && setActiveIndex(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '22px', paddingTop: '48px', zIndex: 20, overflowY: 'auto' }}>
          <section style={{ width: 'min(760px, 100%)', background: '#fff', borderRadius: '12px', boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)', padding: '24px' }} role="dialog" aria-modal="true" aria-labelledby="agent-process-title">
            <h2 id="agent-process-title" style={{ marginTop: 0 }}>{primaryEntry ? activeTitle : 'Verification'}</h2>
            {primaryEntry ? (
              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: '#2d3748', marginBottom: '18px' }} dangerouslySetInnerHTML={{ __html: activeHtml }} />
            ) : (
              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: '#2d3748', marginBottom: '18px' }}>
                {emptyStateMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setActiveIndex(null)} style={{ display: 'inline-block', background: '#1e67cc', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '11px 16px', cursor: 'pointer', textDecoration: 'none' }}>
                Back to Verification
              </button>
              <Link to={resolveHomePath()} onClick={handleBackHome} style={{ display: 'inline-block', background: '#1e67cc', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '11px 16px', cursor: 'pointer', textDecoration: 'none' }}>
                Back to Home
              </Link>
            </div>
          </section>
        </div>
      )}

      <footer style={{ borderTop: '1px solid #d6dbe3', background: '#fff', padding: '14px 16px', textAlign: 'center', fontSize: '12px', lineHeight: 1.4, color: '#4b5563' }}>
        <div>{legalLine1}</div>
        <div>{legalLine2}{syncError ? syncErrorSuffix : ''}</div>
      </footer>
    </div>
  );
};

export default AgentProcess;