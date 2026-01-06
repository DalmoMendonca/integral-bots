export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get('handle') || '').replace(/^@/, '').trim();

  if (!handle) {
    return new Response(JSON.stringify({ error: 'Missing handle' }), { status: 400 });
  }

  const api = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed');
  api.searchParams.set('actor', handle);
  api.searchParams.set('limit', '10');
  api.searchParams.set('filter', 'posts_no_replies');

  const res = await fetch(api.toString(), {
    headers: { accept: 'application/json' },
    // avoid caching so the page feels live
    cache: 'no-store',
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: `Upstream HTTP ${res.status}` }), { status: 502 });
  }

  const json = await res.json();
  const feed = json.feed || [];
  const profile = json?.feed?.[0]?.post?.author || null;

  const posts = feed
    .map((item) => item?.post)
    .filter(Boolean)
    .map((p) => {
      const url = `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`;
      return {
        uri: p.uri,
        cid: p.cid,
        text: p.record?.text || '',
        createdAt: p.indexedAt || p.record?.createdAt || null,
        url,
      };
    });

  const out = {
    handle,
    profile: profile
      ? { displayName: profile.displayName || null, avatar: profile.avatar || null }
      : null,
    posts,
  };

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
