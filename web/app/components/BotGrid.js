'use client';

import { useMemo, useState } from 'react';
import BotFeed from './BotFeed';

export default function BotGrid({ handles }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return handles;
    return handles.filter(h => h.toLowerCase().includes(q));
  }, [handles, query]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-zinc-600">Showing {filtered.length} feeds</div>
        <input
          className="w-64 max-w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
          placeholder="Filter handles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((handle) => (
          <BotFeed key={handle} handle={handle} />
        ))}
      </div>
    </section>
  );
}
