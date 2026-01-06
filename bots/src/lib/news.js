import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: ["media:content", "content:encoded", "dc:creator"]
  }
});

// Expanded diverse news sources for faith, spirituality, and social issues
const DIVERSE_FEEDS = {
  // Mainstream Christian sources
  christianityToday: "https://www.christianitytoday.com/feeds/rss",
  relevantMagazine: "https://relevantmagazine.com/feed",
  faithwire: "https://www.faithwire.com/feed/",
  christianPost: "https://www.christianpost.com/feed/",
  
  // Catholic sources  
  catholicNewsAgency: "https://www.catholicnewsagency.com/feed",
  americaMagazine: "https://www.americamagazine.org/feed",
  nationalCatholicRegister: "https://www.ncregister.com/feed",
  
  // Progressive/Emergent Christian
  sojourners: "https://sojo.net/feed",
  
  // Evangelical sources
  theGospelCoalition: "https://www.thegospelcoalition.org/feed/",
  desiringGod: "https://www.desiringgod.org/feed/rss",
  
  // Social justice and culture
  sojourners: "https://sojo.net/feed",
  
  // Secular sources with religion coverage
  nprReligion: "https://feeds.npr.org/1007/rss.xml", // NPR religion
  apReligion: "https://apnews.com/rss/religion",
  reutersReligion: "https://www.reuters.com/rssFeed/worldFaith",
  
  // Culture and social issues
  atlantic: "https://www.theatlantic.com/feed/all/",
  newYorker: "https://www.newyorker.com/feed/rss",
  vox: "https://www.vox.com/rss/index.xml",
  
  // Political with religious angles
  firstThings: "https://www.firstthings.com/feed",
  publicDiscourse: "https://www.thepublicdiscourse.com/feed",
  
  // Academic/Theological
  christianCentury: "https://www.christiancentury.org/rss.xml",
  commonweal: "https://www.commonwealmagazine.org/feed",
  
  // Spirituality/Mysticism
  richardRohr: "https://cac.org/feed/",
  contemplativePractices: "https://www.contemplative.org/feed/",
  
  // Culture war topics
  theFederalist: "https://www.thefederalist.com/feed/",
  vox: "https://www.vox.com/rss/index.xml",
  
  // International religious news
  bbcReligion: "https://www.bbc.co.uk/news/religion_and_ethics/rss.xml",
  euronewsReligion: "https://www.euronews.com/tag/religion/rss",
};

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

export async function fetchDiverseContent(maxPerFeed = 5) {
  // Sample a diverse subset of feeds each run to avoid overwhelming
  const feedKeys = Object.keys(DIVERSE_FEEDS);
  const sampledKeys = [];
  
  // Ensure we get different categories each run
  const categories = [
    ['christianityToday', 'relevantMagazine', 'faithwire'], // Mainstream
    ['catholicNewsAgency', 'americaMagazine', 'nationalCatholicRegister'], // Catholic
    ['sojourners'], // Progressive
    ['theGospelCoalition', 'desiringGod'], // Evangelical
    ['nprReligion', 'apReligion', 'reutersReligion'], // Secular religion
    ['atlantic', 'newYorker', 'vox'], // Culture
    ['firstThings', 'publicDiscourse'], // Political
    ['christianCentury', 'commonweal'], // Academic
    ['richardRohr', 'contemplativePractices'], // Mystical
    ['theFederalist'], // Culture war
    ['bbcReligion', 'euronewsReligion'], // International
  ];
  
  // Sample 1-2 feeds from each category
  categories.forEach(category => {
    const available = category.filter(key => feedKeys.includes(key));
    if (available.length > 0) {
      const selected = available[Math.floor(Math.random() * available.length)];
      sampledKeys.push(selected);
    }
  });
  
  // Add some random extras for variety
  const remaining = feedKeys.filter(key => !sampledKeys.includes(key));
  const extraCount = Math.min(3, remaining.length);
  for (let i = 0; i < extraCount; i++) {
    const randomIndex = Math.floor(Math.random() * remaining.length);
    sampledKeys.push(remaining[randomIndex]);
    remaining.splice(randomIndex, 1);
  }
  
  const selectedFeeds = sampledKeys.map(key => DIVERSE_FEEDS[key]);
  return await fetchRssItems(selectedFeeds, maxPerFeed);
}

export function pickTopicForPersona({ personaKey, items, trending, state }) {
  const seen = new Set(state?.bots?.[personaKey]?.seen ?? []);
  const candidates = [];

  // ONLY use RSS items for regular posts (trending are for replies only)
  for (const it of items) {
    if (it.link && seen.has(it.link)) continue;
    // ignore suspiciously short titles
    if (it.title.length < 20) continue;
    candidates.push(it);
  }

  // Enhanced topic selection based on persona preferences
  candidates.sort((a, b) => {
    const aScore = scoreTopicForPersona(a, personaKey);
    const bScore = scoreTopicForPersona(b, personaKey);
    return bScore - aScore;
  });

  // Add some randomness to avoid predictability
  if (candidates.length > 1) {
    const topCandidates = candidates.slice(0, Math.min(5, candidates.length));
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
  }

  return candidates[0] ?? null;
}

function scoreTopicForPersona(topic, personaKey) {
  let score = Math.random() * 0.3; // Base randomness
  
  const title = (topic.title + " " + topic.source).toLowerCase();
  
  // Persona-specific topic preferences
  const preferences = {
    RUTH: {
      keywords: ['miracle', 'healing', 'prayer', 'faith', 'spiritual', 'god', 'jesus', 'worship'],
      sources: ['faithwire', 'desiringgod', 'relevant'],
      boost: 0.8
    },
    BRYCE: {
      keywords: ['war', 'culture', 'battle', 'justice', 'moral', 'conservative', 'traditional'],
      sources: ['thefederalist', 'firstthings', 'christianpost'],
      boost: 0.7
    },
    JERRY: {
      keywords: ['church', 'tradition', 'doctrine', 'theology', 'catholic', 'protestant'],
      sources: ['catholicnewsagency', 'christiancentury', 'americamagazine'],
      boost: 0.6
    },
    RAYMOND: {
      keywords: ['science', 'research', 'study', 'analysis', 'evidence', 'psychology'],
      sources: ['theatlantic', 'newyorker', 'npr'],
      boost: 0.7
    },
    PARKER: {
      keywords: ['justice', 'equity', 'social', 'race', 'gender', 'lgbtq', 'marginalized'],
      sources: ['sojourners', 'vox', 'theatlantic'],
      boost: 0.8
    },
    KENNY: {
      keywords: ['integral', 'development', 'stages', 'consciousness', 'theory', 'framework'],
      sources: ['cac', 'contemplative', 'firstthings'],
      boost: 0.6
    },
    ANDREA: {
      keywords: ['contemplative', 'mystical', 'meditation', 'silence', 'presence', 'unity'],
      sources: ['cac', 'contemplative', 'richardrohr'],
      boost: 0.8
    }
  };
  
  const pref = preferences[personaKey];
  if (pref) {
    // Keyword matching
    pref.keywords.forEach(keyword => {
      if (title.includes(keyword)) score += pref.boost;
    });
    
    // Source preference
    pref.sources.forEach(source => {
      if (topic.source.toLowerCase().includes(source)) score += pref.boost * 0.5;
    });
  }
  
  // General religion/spirituality boost for all personas
  if (/religion|faith|spiritual|god|jesus|church|theology|christian/i.test(title)) {
    score += 0.4;
  }
  
  // Culture war topics get boost for certain personas
  if (/culture|politics|conservative|liberal|progressive|traditional/i.test(title)) {
    if (['BRYCE', 'PARKER', 'RAYMOND'].includes(personaKey)) {
      score += 0.5;
    }
  }
  
  return score;
}

export function updateSeen(state, personaKey, linkKey, maxSeen = 200) {
  if (!state.bots) state.bots = {};
  if (!state.bots[personaKey]) state.bots[personaKey] = {};
  const arr = state.bots[personaKey].seen ?? [];
  arr.unshift(linkKey);
  state.bots[personaKey].seen = Array.from(new Set(arr)).slice(0, maxSeen);
}
