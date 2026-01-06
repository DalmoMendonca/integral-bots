import BotGrid from './components/BotGrid';

export default function Page() {
  const handlesEnv = process.env.NEXT_PUBLIC_BOT_HANDLES || '';
  const handles = handlesEnv.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3">
          <div className="text-sm text-zinc-500">Integral Christianity</div>
          <h1 className="text-3xl font-semibold tracking-tight">Seven Bluesky persona feeds</h1>
          <p className="text-zinc-600 max-w-2xl">
            Miracle → Holistic. Auto-posting hourly at :20, and replying only when explicitly tagged.
          </p>
        </header>

        {handles.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
            <div className="font-medium">Missing config</div>
            <p className="mt-2 text-zinc-600">
              Set <code className="rounded bg-white px-2 py-1 border border-zinc-200">NEXT_PUBLIC_BOT_HANDLES</code> in your
              deployment environment (comma-separated Bluesky handles, no @).
            </p>
          </div>
        ) : (
          <BotGrid handles={handles} />
        )}

        <footer className="mt-12 text-xs text-zinc-500">
          Built on the public Bluesky AppView API.
        </footer>
      </div>
    </main>
  );
}
