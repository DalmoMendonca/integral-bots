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
    <section className="mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <div className="text-sm font-medium text-slate-700">
            {filtered.length} Active Feed{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="relative">
          <input
            className="w-64 max-w-full rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all shadow-sm"
            placeholder="Search personas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && query && (
        <div className="text-center py-12">
          <div className="text-slate-500 mb-2">No personas found matching "{query}"</div>
          <button
            onClick={() => setQuery('')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((handle) => (
          <BotFeed key={handle} handle={handle} />
        ))}
      </div>
    </section>
  );
}
