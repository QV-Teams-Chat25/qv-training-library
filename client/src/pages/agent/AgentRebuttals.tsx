import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getLiveRebuttals } from '../../apiService';

const CAMPAIGNS = [
  'General',
  'Brown (NNL, PD)',
  'Cruz ($250+ PD, MR, ND, PD)',
  'NRS (NNL, PD)',
  'Paxton (NNL, PD)',
  'Presidential Victory Fund PD',
  'RNC (NNL, Sp NNL, Sp PD $250+, Sp PD, UNF PD)',
  'SCF NNL',
  'TPP PD',
];
const ALL_CAMPAIGNS = 'All';

const legalLine1 = 'Copyright © 2026 Quality Voices LLC. All rights reserved. Confidential and proprietary information for authorized business use only.';
const legalLine2 = 'IT Legal Notice: Unauthorized access, use, disclosure, copying, or distribution is prohibited and may result in disciplinary action, civil liability, and criminal penalties.';
const syncErrorSuffix = ' Sync Error';

type RebuttalEntry = {
  campaign: string;
  title: string;
  content: string;
  deliveryTip: string;
};

const PRESENTATION_BREAK_PATTERN = /<hr[^>]*data-qv-break=["']presentation["'][^>]*\/?>(?:<\/hr>)?|<div[^>]*data-qv-break=["']presentation["'][^>]*>[\s\S]*?<\/div>/i;

const normalizeRenderedHtml = (html: string) => {
  if (!html) {
    return '';
  }
  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
};

const splitPresentationSections = (html: string) => {
  const normalized = normalizeRenderedHtml(html);
  if (!normalized) {
    return {
      rebuttalHtml: '',
      presentationHtml: '',
    };
  }

  const match = normalized.match(PRESENTATION_BREAK_PATTERN);
  if (!match || typeof match.index !== 'number') {
    return {
      rebuttalHtml: normalized,
      presentationHtml: '',
    };
  }

  return {
    rebuttalHtml: normalized.slice(0, match.index).trim(),
    presentationHtml: normalized.slice(match.index + match[0].length).trim(),
  };
};

const getCampaignScript = (campaignData: unknown, campaign: string) => {
  if (typeof campaignData === 'string') {
    return {
      title: campaign,
      content: campaignData,
      deliveryTip: '',
    };
  }

  if (campaignData && typeof campaignData === 'object' && !Array.isArray(campaignData)) {
    const record = campaignData as Record<string, unknown>;
    const title = typeof record.title === 'string' && record.title.trim() ? record.title : campaign;
    const content = typeof record.content === 'string' ? record.content : '';
    const deliveryTip = typeof record.deliveryTip === 'string' ? record.deliveryTip : '';
    if ('title' in record || 'content' in record || 'deliveryTip' in record) {
      return {
        title,
        content,
        deliveryTip,
      };
    }

    const firstStringValue = Object.values(record).find((entry) => typeof entry === 'string') as string | undefined;
    return {
      title: campaign,
      content: firstStringValue || '',
      deliveryTip: '',
    };
  }

  return {
    title: campaign,
    content: '',
    deliveryTip: '',
  };
};

const getCampaignEntries = (campaignData: unknown, campaign: string): RebuttalEntry[] => {
  if (!campaignData) {
    return [];
  }

  if (typeof campaignData === 'string') {
    return campaignData.trim() ? [{ campaign, title: campaign, content: campaignData, deliveryTip: '' }] : [];
  }

  if (campaignData && typeof campaignData === 'object' && !Array.isArray(campaignData)) {
    const record = campaignData as Record<string, unknown>;
    if ('title' in record || 'content' in record || 'deliveryTip' in record) {
      const script = getCampaignScript(campaignData, campaign);
      return script.content.trim() ? [{ campaign, title: script.title, content: script.content, deliveryTip: script.deliveryTip }] : [];
    }

    return Object.keys(record)
      .map((key) => {
        const value = record[key];
        if (typeof value === 'string') {
          return value.trim() ? { campaign, title: key, content: value, deliveryTip: '' } : null;
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nested = value as Record<string, unknown>;
          const title = typeof nested.title === 'string' && nested.title.trim() ? nested.title : key;
          const content = typeof nested.content === 'string' ? nested.content : '';
          const deliveryTip = typeof nested.deliveryTip === 'string' ? nested.deliveryTip : '';
          return content.trim() ? { campaign, title, content, deliveryTip } : null;
        }

        return null;
      })
      .filter((entry): entry is RebuttalEntry => entry !== null);
  }

  return [];
};

const AgentRebuttals: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [rebuttals, setRebuttals] = useState<Record<string, unknown>>({});
  const [activeCampaign, setActiveCampaign] = useState(CAMPAIGNS[0]);
  const [syncError, setSyncError] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredTipIndex, setHoveredTipIndex] = useState<number | null>(null);

  const refreshLiveRebuttals = async (cancelled = false) => {
    try {
      const data = await getLiveRebuttals();
      const freshLive = data.live && typeof data.live === 'object' ? { ...data.live } : {};
      const isEmptyLive = Object.keys(freshLive).length === 0;

      if (!cancelled) {
        setRebuttals(isEmptyLive ? {} : freshLive);
        setActiveIndex((current) => (isEmptyLive ? null : current));
        setSyncError(false);
      }
      return isEmptyLive ? {} : freshLive;
    } catch {
      if (!cancelled) {
        setRebuttals({});
        setActiveIndex(null);
        setSyncError(true);
      }
      return {};
    }
  };

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const params = new URLSearchParams(location.search);
    const campaignParam = params.get('campaign');
    const availableCampaigns = Array.from(new Set([...CAMPAIGNS, ...Object.keys(rebuttals || {})]));
    if (campaignParam && (campaignParam === ALL_CAMPAIGNS || availableCampaigns.includes(campaignParam))) {
      setActiveCampaign(campaignParam);
    }

    void refreshLiveRebuttals(cancelled);
    intervalId = window.setInterval(() => {
      void refreshLiveRebuttals(cancelled);
    }, 5000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    void refreshLiveRebuttals(cancelled);
    setActiveIndex(null);
    setHoveredTipIndex(null);
    return () => {
      cancelled = true;
    };
  }, [activeCampaign]);

  const getAllCampaignEntries = () => {
    return CAMPAIGNS.flatMap((campaign) => getCampaignEntries(rebuttals[campaign], campaign));
  };

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

  const availableCampaigns = Array.from(new Set([...CAMPAIGNS, ...Object.keys(rebuttals || {})])).filter((campaign) => campaign && campaign !== ALL_CAMPAIGNS);
  const allCampaignEntries = getAllCampaignEntries();
  const displayedEntries: Array<RebuttalEntry | null> = activeCampaign === ALL_CAMPAIGNS
    ? Array.from({ length: 16 }, (_, index) => allCampaignEntries[index] || null)
    : getCampaignEntries(rebuttals[activeCampaign], activeCampaign);
  const activeEntry = activeIndex === null ? null : displayedEntries[activeIndex] || null;
  const { rebuttalHtml, presentationHtml } = splitPresentationSections(activeEntry?.content || '');
  const activeTitle = activeEntry ? activeEntry.title : 'Rebuttal';

  return (
    <div style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', background: '#f0f2f5', color: '#233044' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '20px', textAlign: 'center' }}>
        <h1>QV Training Library --- Rebutals</h1>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <section style={{ width: 'min(900px, 100%)', background: '#ffffff', borderRadius: '12px', boxShadow: '0 6px 22px rgba(0, 0, 0, 0.08)', padding: '28px' }}>
          <h2 style={{ marginTop: 0, color: '#003366' }}>Rebuttals</h2>
          <p style={{ color: '#6a7380', marginBottom: '22px' }}>Select a campaign, then select a rebuttal box to open the published script language.</p>

          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="campaignSelect" style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: '#355070', marginBottom: '8px' }}>
              Select Active Campaign:
            </label>
            <select
              id="campaignSelect"
              value={activeCampaign}
              onChange={(event) => {
                setActiveCampaign(event.target.value);
                void refreshLiveRebuttals();
              }}
              style={{ width: '100%', maxWidth: '520px', padding: '10px 12px', border: '1px solid #cfd8e3', borderRadius: '8px', background: '#fff', color: '#233044', fontSize: '15px' }}
            >
              <option value={ALL_CAMPAIGNS}>{ALL_CAMPAIGNS}</option>
              {availableCampaigns.map((campaign) => (
                <option key={campaign} value={campaign}>
                  {campaign}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: activeCampaign === ALL_CAMPAIGNS ? 'repeat(4, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {displayedEntries.map((entry, index) => (
              <button
                key={entry ? `${entry.campaign}-${entry.title}-${index}` : `placeholder-${index}`}
                className="grid-btn"
                title={entry ? entry.title : undefined}
                onClick={async () => {
                  if (!entry) {
                    return;
                  }
                  const freshLive = await refreshLiveRebuttals();
                  setRebuttals(freshLive);
                  setHoveredTipIndex(null);
                  setActiveIndex(index);
                }}
                onMouseLeave={() => setHoveredTipIndex((current) => (current === index ? null : current))}
                disabled={!entry}
                style={{ border: entry ? '1px solid #cbdcf2' : '1px dashed #d8deea', background: entry ? 'linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%)' : '#f8fafc', color: entry ? '#13406f' : '#8a97ab', fontWeight: 700, fontSize: activeCampaign === ALL_CAMPAIGNS ? '16px' : '18px', letterSpacing: '0.01em', borderRadius: '10px', padding: '16px 10px', cursor: entry ? 'pointer' : 'default', minHeight: activeCampaign === ALL_CAMPAIGNS ? '64px' : '72px', boxShadow: entry ? 'inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(16, 54, 92, 0.08)' : 'none', transition: 'background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease', textAlign: 'center', position: 'relative', overflow: 'visible', zIndex: hoveredTipIndex === index ? 5 : 1 }}
              >
                <div
                  title={entry?.deliveryTip ? `Delivery Tip: ${entry.deliveryTip}` : undefined}
                  onMouseEnter={() => {
                    if (entry?.deliveryTip) {
                      setHoveredTipIndex(index);
                    }
                  }}
                  onFocus={() => {
                    if (entry?.deliveryTip) {
                      setHoveredTipIndex(index);
                    }
                  }}
                  onBlur={() => setHoveredTipIndex((current) => (current === index ? null : current))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: activeCampaign === ALL_CAMPAIGNS ? 'space-between' : 'center', gap: '8px', width: '100%', textAlign: activeCampaign === ALL_CAMPAIGNS ? 'left' : 'center' }}
                >
                  <span style={{ flex: 1 }}>
                    {entry ? entry.title : '---'}
                  </span>
                  {entry?.deliveryTip ? <span aria-label="Has delivery tip" style={{ fontSize: '12px', flexShrink: 0 }}>💡</span> : null}
                </div>
                {entry?.deliveryTip && hoveredTipIndex === index ? (
                  <div style={{ position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)', width: 'min(260px, 75vw)', background: '#1f2937', color: '#fff', padding: '10px 12px', borderRadius: '8px', boxShadow: '0 8px 18px rgba(0,0,0,0.22)', fontSize: '12px', lineHeight: 1.4, textAlign: 'left', zIndex: 999, pointerEvents: 'none' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Delivery Tip</div>
                    <div>{entry.deliveryTip}</div>
                  </div>
                ) : null}
              </button>
            ))}
            {activeCampaign !== ALL_CAMPAIGNS && displayedEntries.length === 0 ? (
              <div style={{ color: '#6a7380', fontSize: '14px', padding: '8px 2px', gridColumn: '1 / -1' }}>
                {`No live rebuttals are currently published for ${activeCampaign}.`}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'center' }}>
            <Link
              to={resolveHomePath()}
              onClick={handleBackHome}
              style={{ background: '#1e67cc', color: '#fff', textDecoration: 'none', fontWeight: 700, padding: '12px 18px', borderRadius: '8px', border: 'none' }}
            >
              Back to Home
            </Link>
          </div>
        </section>
      </main>

      {activeIndex !== null && (
        <div onClick={(event) => event.target === event.currentTarget && setActiveIndex(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto', zIndex: 20 }}>
          <section style={{ width: 'min(1180px, 98vw)', maxHeight: 'calc(100vh - 40px)', background: '#fff', borderRadius: '12px', boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22)', padding: '24px', display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true" aria-labelledby="agent-rebuttal-title">
            <h2 id="agent-rebuttal-title" style={{ marginTop: 0, marginBottom: '14px' }}>{activeTitle}</h2>
            <div style={{ overflowY: 'auto', paddingRight: '4px' }}>
              {presentationHtml ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ border: '1px solid #d6dbe3', borderRadius: '8px', padding: '18px 20px' }}>
                    <div style={{ fontWeight: 700, color: '#003366', marginBottom: '8px' }}>Rebuttal</div>
                    <div style={{ whiteSpace: 'pre-line', lineHeight: 1.7, color: '#2d3748', fontSize: '18px' }} dangerouslySetInnerHTML={{ __html: rebuttalHtml || 'No rebuttal text has been added yet.' }} />
                  </div>
                  <div style={{ border: '1px solid #ecd981', borderRadius: '8px', padding: '20px 22px', background: '#fff8d9' }}>
                    <div style={{ fontWeight: 700, color: '#6a5510', marginBottom: '10px', fontSize: '18px' }}>3rd Presentation</div>
                    <div style={{ whiteSpace: 'pre-line', lineHeight: 1.75, color: '#2d3748', fontSize: '18px' }} dangerouslySetInnerHTML={{ __html: presentationHtml }} />
                  </div>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.7, color: '#2d3748', marginBottom: '18px', fontSize: '18px' }} dangerouslySetInnerHTML={{ __html: rebuttalHtml || 'Live rebuttal content has not been published yet for this campaign and rebuttal. Please continue to follow the current approved workflow guidance.' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '14px', borderTop: '1px solid #e5e7eb', background: '#fff', position: 'sticky', bottom: 0 }}>
              <Link
                to={resolveHomePath()}
                onClick={handleBackHome}
                style={{ display: 'inline-block', background: '#003366', color: '#fff', fontWeight: 700, textDecoration: 'none', borderRadius: '8px', padding: '11px 16px' }}
              >
                Back to Home
              </Link>
              <button onClick={() => setActiveIndex(null)} style={{ display: 'inline-block', background: '#1e67cc', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '11px 16px', cursor: 'pointer' }}>
                Back to Rebuttals
              </button>
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

export default AgentRebuttals;