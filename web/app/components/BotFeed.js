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

export default function BotFeed({ handle }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const profileUrl = useMemo(() => `https://bsky.app/profile/${handle}`, [handle]);

  async function load() {
    setLoading(true);
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
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{data?.profile?.displayName || handle}</div>
          <a className="truncate text-sm text-zinc-500 hover:underline" href={profileUrl} target="_blank" rel="noreferrer">
            @{handle}
          </a>
        </div>
        <button
          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          onClick={load}
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <div className="px-4 py-3">
        {loading && <div className="text-sm text-zinc-500">Loading…</div>}
        {err && <div className="text-sm text-red-600">{err}</div>}

        {!loading && !err && (data?.posts?.length ?? 0) === 0 && (
          <div className="text-sm text-zinc-500">No posts yet.</div>
        )}

        <div className="flex flex-col gap-3">
          {(data?.posts ?? []).slice(0, 6).map((p) => (
            <a
              key={p.uri}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-zinc-100 p-3 hover:border-zinc-200 hover:bg-zinc-50"
            >
              <div className="text-sm leading-snug text-zinc-900 whitespace-pre-wrap">{p.text}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>{timeAgo(p.createdAt)}</span>
                <span className="opacity-80 group-hover:opacity-100">Open</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
