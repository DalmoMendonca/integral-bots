export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get('handle') || '').replace(/^@/, '').trim();

  if (!handle) {
    return new Response(JSON.stringify({ error: 'Missing handle' }), { 
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  try {
    const api = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed');
    api.searchParams.set('actor', handle);
    api.searchParams.set('limit', '10');
    api.searchParams.set('filter', 'posts_no_replies');

    const res = await fetch(api.toString(), {
      headers: { 
        accept: 'application/json',
        'User-Agent': 'Integral-Bots-Feed/1.0'
      },
      // avoid caching so the page feels live
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Bluesky API error for ${handle}:`, res.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Bluesky API error: ${res.status}`,
        details: errorText
      }), { 
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
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
          // Additional metadata for future enhancements
          likeCount: p.likeCount || 0,
          replyCount: p.replyCount || 0,
          repostCount: p.repostCount || 0,
          embed: p.embed || null,
          facets: p.facets || []
        };
      });

    const out = {
      handle,
      profile: profile
        ? { 
            displayName: profile.displayName || null, 
            avatar: profile.avatar || null,
            description: profile.description || null,
            followersCount: profile.followersCount || 0,
            followsCount: profile.followsCount || 0,
            postsCount: profile.postsCount || 0
          }
        : null,
      posts,
      lastUpdated: new Date().toISOString()
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { 
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
        'pragma': 'no-cache',
        'expires': '0'
      },
    });

  } catch (error) {
    console.error(`Feed API error for ${handle}:`, error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), { 
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
}
