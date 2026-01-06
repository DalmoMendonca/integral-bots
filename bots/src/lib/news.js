import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: ["media:content", "content:encoded", "dc:creator"]
  }
});

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    // strip common tracking params
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(k => url.searchParams.delete(k));
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

export async function fetchRssItems(feedUrls, maxPerFeed = 10) {
  const out = [];
  const tasks = feedUrls.map(async (feedUrl) => {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of (feed.items ?? []).slice(0, maxPerFeed)) {
        if (!item?.title) continue;
        const link = item.link ? normalizeUrl(item.link) : null;
        const date = item.isoDate ?? item.pubDate ?? null;
        out.push({
          type: "news",
          source: feed.title ?? new URL(feedUrl).hostname,
          title: String(item.title).trim(),
          link,
          date,
          feedUrl,
        });
      }
    } catch (e) {
      // ignore single-feed failures; this is normal with some RSS hosts
      out.push({
        type: "error",
        source: new URL(feedUrl).hostname,
        title: `RSS fetch failed: ${feedUrl}`,
        link: null,
        date: null,
        feedUrl,
        error: String(e?.message ?? e),
      });
    }
  });
  await Promise.allSettled(tasks);

  // filter out the error objects for picking content later
  return out.filter(x => x.type === "news");
}

export async function fetchTrendingTopics(limit = 20) {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { "accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const topics = (json.topics ?? []).map(t => ({
      type: "trend",
      source: "Bluesky trending",
      title: t.topic ?? t.displayName ?? String(t),
      link: null,
      date: null,
    }));
    const suggested = (json.suggested ?? []).map(t => ({
      type: "trend",
      source: "Bluesky suggested",
      title: t.topic ?? t.displayName ?? String(t),
      link: null,
      date: null,
    }));
    return [...topics, ...suggested].filter(x => x.title && x.title.length < 60);
  } catch {
    return [];
  }
}

export function pickTopicForPersona({ personaKey, items, trending, state }) {
  const seen = new Set(state?.bots?.[personaKey]?.seen ?? []);
  const candidates = [];

  // prefer fresh news first
  for (const it of items) {
    if (it.link && seen.has(it.link)) continue;
    // ignore suspiciously short titles
    if (it.title.length < 20) continue;
    candidates.push(it);
  }
  // fallback: trending topics (no link)
  for (const t of trending) {
    const key = `trend:${t.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    candidates.push({ ...t, link: key });
  }

  // light shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // bias toward religion sources first
  candidates.sort((a, b) => {
    const aRel = /religion|catholic|christian|church|vatican/i.test(a.source + " " + a.title);
    const bRel = /religion|catholic|christian|church|vatican/i.test(b.source + " " + b.title);
    return (bRel ? 1 : 0) - (aRel ? 1 : 0);
  });

  return candidates[0] ?? null;
}

export function updateSeen(state, personaKey, linkKey, maxSeen = 200) {
  if (!state.bots) state.bots = {};
  if (!state.bots[personaKey]) state.bots[personaKey] = {};
  const arr = state.bots[personaKey].seen ?? [];
  arr.unshift(linkKey);
  state.bots[personaKey].seen = Array.from(new Set(arr)).slice(0, maxSeen);
}
