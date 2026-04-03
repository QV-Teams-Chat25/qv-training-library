import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getTransitions, TransitionFileRef } from '../../apiService';

const legalLine1 = 'Copyright © 2026 Quality Voices LLC. All rights reserved. Confidential and proprietary information for authorized business use only.';
const legalLine2 = 'IT Legal Notice: Unauthorized access, use, disclosure, copying, or distribution is prohibited and may result in disciplinary action, civil liability, and criminal penalties.';
const syncErrorSuffix = ' Sync Error';

const AgentTransitions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [liveTransition, setLiveTransition] = useState<TransitionFileRef | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const load = async () => {
      try {
        const data = await getTransitions();
        const freshLive = data.live && data.live.dataUrl ? data.live : null;

        if (!cancelled) {
          setLiveTransition(freshLive);
          setOpen((current) => (freshLive ? current : false));
          setSyncError(false);
        }
      } catch {
        if (!cancelled) {
          setLiveTransition(null);
          setOpen(false);
          setSyncError(true);
        }
      }
    };

    void load();
    intervalId = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
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

  const fileName = liveTransition?.fileName || 'Transitions-Document';
  const mimeType = liveTransition?.mimeType || '';
  const dataUrl = liveTransition?.dataUrl || '';
  const hasTransitionContent = !!dataUrl;
  const transitionLabel = (fileName || 'Transitions').replace(/\.[^.]+$/, '');
  const isPdf = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf') || dataUrl.startsWith('data:application/pdf');
  const pdfViewerUrl = isPdf && dataUrl
    ? `${dataUrl}#page=1&view=FitH&zoom=page-width&toolbar=0&navpanes=0&scrollbar=1`
    : dataUrl;

  return (
    <div style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', background: '#f0f2f5', color: '#233044' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '20px', textAlign: 'center' }}>
        <h1>QV Training Library --- Transitions</h1>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <section style={{ width: 'min(900px, 100%)', background: '#ffffff', borderRadius: '12px', boxShadow: '0 6px 22px rgba(0, 0, 0, 0.08)', padding: '28px' }}>
          <h2 style={{ marginTop: 0, color: '#003366' }}>Transitions</h2>
          <p style={{ color: '#6a7380', marginBottom: '22px' }}>This section displays manager-approved Transition do&apos;s and don&apos;ts after document upload and publication.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: '12px', maxWidth: '560px', margin: '0 auto' }}>
            <button onClick={() => hasTransitionContent && setOpen(true)} disabled={!hasTransitionContent} style={{ border: hasTransitionContent ? '1px solid #cbdcf2' : '1px solid transparent', background: hasTransitionContent ? 'linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)' : 'transparent', color: '#13406f', fontWeight: 700, fontSize: '20px', letterSpacing: '0.01em', borderRadius: '10px', padding: '16px 10px', cursor: hasTransitionContent ? 'pointer' : 'default', minHeight: '72px', boxShadow: hasTransitionContent ? 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(16, 54, 92, 0.08)' : 'none', transition: 'background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease', visibility: hasTransitionContent ? 'visible' : 'hidden' }}>
              {transitionLabel}
            </button>
          </div>

          <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'center' }}>
            <Link to={resolveHomePath()} onClick={handleBackHome} style={{ background: '#1e67cc', color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '12px 18px', borderRadius: '8px', border: 'none' }}>
              Back to Home
            </Link>
          </div>
        </section>
      </main>

      {open && (
        <div onClick={(event) => event.target === event.currentTarget && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', paddingTop: '28px', zIndex: 20, overflowY: 'auto' }}>
          <section style={{ width: 'min(1280px, 96vw)', background: '#fff', borderRadius: '12px', boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)', padding: '20px' }} role="dialog" aria-modal="true" aria-labelledby="agent-transitions-title">
            <h2 id="agent-transitions-title">{transitionLabel}</h2>
            <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, color: '#2d3748', marginBottom: '18px' }}>
              {!liveTransition || !liveTransition.dataUrl ? (
                'Live transitions content has not been published yet. Please continue to follow current approved workflow guidance until Management publishes this document.'
              ) : isPdf ? (
                <>
                  <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <a href={dataUrl} target="_blank" rel="noopener noreferrer">{`Open/Download ${fileName}`}</a>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Viewer opens from page 1 in a larger reading view.</span>
                  </div>
                  <iframe title="Transitions Document" src={pdfViewerUrl} style={{ width: '100%', height: '78vh', border: '1px solid #d6dbe3', borderRadius: '8px', background: '#fff' }} />
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <a href={dataUrl} download={fileName}>{`View/Download ${fileName}`}</a>
                  </div>
                  <div>Document preview is not available for this file type in-browser. Use the link above to open or download.</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => setOpen(false)} style={{ display: 'inline-block', background: '#1e67cc', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '11px 16px', cursor: 'pointer', textDecoration: 'none' }}>
                Back to Transitions
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

export default AgentTransitions;