'use client';

import { useEffect, useMemo, useState } from 'react';

function timeAgo(iso) {
  try {
    const dt = new Date(iso);
    const diff = Date.now() - dt.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  } catch {
    return '';
  }
}

// Persona colors and stages with actual handle mappings
const PERSONAS = {
  ruth: { stage: 'Miracle', color: '#d81b60', bgColor: '#fce4ec', borderColor: '#f8bbd9' },
  bryce: { stage: 'Warrior', color: '#e53935', bgColor: '#ffebee', borderColor: '#ffcdd2' },
  jerry: { stage: 'Traditional', color: '#ffb300', bgColor: '#fff8e1', borderColor: '#ffecb3' },
  raymond: { stage: 'Modern', color: '#fb8c00', bgColor: '#fff3e0', borderColor: '#ffe0b2' },
  parker: { stage: 'Postmodern', color: '#7cb342', bgColor: '#f1f8e9', borderColor: '#dcedc8' },
  kenny: { stage: 'Integral', color: '#26a69a', bgColor: '#e0f2f1', borderColor: '#b2dfdb' },
  andrea: { stage: 'Holistic', color: '#26c6da', bgColor: '#e0f7fa', borderColor: '#b2ebf2' }
};

// Direct handle-to-persona mapping for accuracy
const HANDLE_MAPPINGS = {
  'sisterruthmartinez.bsky.social': 'ruth',
  'thebrycepowell.bsky.social': 'bryce', 
  'revjerryjohnson.bsky.social': 'jerry',
  'drraymondmoore.bsky.social': 'raymond',
  'p42k32.bsky.social': 'parker',
  'kennysmithjr.bsky.social': 'kenny',
  'mrsandreasimmons.bsky.social': 'andrea'
};

function getPersonaInfo(handle) {
  const handleLower = handle.toLowerCase();
  
  // First try exact handle mapping
  if (HANDLE_MAPPINGS[handleLower]) {
    const personaKey = HANDLE_MAPPINGS[handleLower];
    return { name: personaKey.charAt(0).toUpperCase() + personaKey.slice(1), ...PERSONAS[personaKey] };
  }
  
  // Fallback to pattern matching for any new handles
  for (const [key, info] of Object.entries(PERSONAS)) {
    if (handleLower.includes(key)) {
      return { name: key.charAt(0).toUpperCase() + key.slice(1), ...info };
    }
  }
  
  return { name: 'Unknown', stage: 'Unknown', color: '#64748b', bgColor: '#f8fafc', borderColor: '#e2e8f0' };
}

export default function BotFeed({ handle }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const personaInfo = useMemo(() => getPersonaInfo(handle), [handle]);
  const profileUrl = useMemo(() => `https://bsky.app/profile/${handle}`, [handle]);

  async function load() {
    if (!isRefreshing) setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/api/feed?handle=${encodeURIComponent(handle)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setErr(e?.message ?? 'Failed');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  async function refresh() {
    setIsRefreshing(true);
    await load();
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return (
    <div 
      className="rounded-3xl border-2 bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
      style={{ borderColor: personaInfo.color }}
    >
      {/* Header with persona branding */}
      <div 
        className="p-4 border-b-2"
        style={{ borderColor: personaInfo.color, backgroundColor: personaInfo.bgColor }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div 
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
              style={{ backgroundColor: personaInfo.color }}
            >
              {personaInfo.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 truncate">
                {data?.profile?.displayName || personaInfo.name}
              </div>
              <div className="flex items-center gap-2">
                <a 
                  className="text-sm font-medium hover:underline transition-colors truncate"
                  style={{ color: personaInfo.color }}
                  href={profileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                >
                  @{handle}
                </a>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: personaInfo.color }}
                >
                  {personaInfo.stage}
                </span>
              </div>
            </div>
          </div>
          <button
            className="rounded-xl border-2 px-3 py-1.5 text-xs font-medium transition-all hover:scale-105 active:scale-95 shadow-sm"
            style={{ 
              borderColor: personaInfo.color, 
              color: personaInfo.color,
              backgroundColor: 'white'
            }}
            onClick={refresh}
            disabled={isRefreshing}
            title="Refresh feed"
          >
            {isRefreshing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Posts section */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {loading && !isRefreshing && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
            <span className="ml-2 text-sm text-slate-500">Loading feed...</span>
          </div>
        )}
        
        {err && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 border border-red-200">
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm text-red-700">{err}</div>
          </div>
        )}

        {!loading && !err && (data?.posts?.length ?? 0) === 0 && (
          <div className="text-center py-8">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="text-sm text-slate-500">No posts yet</div>
            <div className="text-xs text-slate-400 mt-1">Posts will appear here automatically</div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {(data?.posts ?? []).slice(0, 6).map((p, index) => (
            <div
              key={p.uri}
              className="group rounded-2xl border p-3 hover:shadow-md transition-all duration-200 cursor-pointer"
              style={{ 
                borderColor: `${personaInfo.color}20`,
                backgroundColor: index === 0 ? `${personaInfo.bgColor}40` : 'white'
              }}
              onClick={() => window.open(p.url, '_blank')}
            >
              <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                {p.text}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: personaInfo.color }}>
                  {timeAgo(p.createdAt)}
                </span>
                <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                  <span>View on Bluesky</span>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div 
        className="px-4 py-2 border-t text-center"
        style={{ borderColor: `${personaInfo.color}30` }}
      >
        <a
          href={profileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium hover:underline transition-colors"
          style={{ color: personaInfo.color }}
        >
          View full profile →
        </a>
      </div>
    </div>
  );
}
