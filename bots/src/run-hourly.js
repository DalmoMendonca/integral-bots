import { loadConfig } from "./lib/config.js";
import { BOT_ORDER } from "./lib/personas.js";
import { fetchRssItems, fetchTrendingTopics, pickTopicForPersona, updateSeen } from "./lib/news.js";
import { composePost, composeReply } from "./lib/compose.js";
import { loginAgent, createPost, listMentions, replyToUri } from "./lib/bsky.js";
import { loadState, saveState, wasNotificationSeen, markNotificationSeen } from "./lib/state.js";

function normalizeHandle(h) {
  if (!h) return h;
  return String(h).replace(/^@/, "").trim();
}

function buildAllHandles(config) {
  const out = {};
  for (const key of Object.keys(config.bots)) {
    out[key] = normalizeHandle(config.bots[key].handle);
  }
  return out;
}

async function run() {
  const config = loadConfig();
  const state = loadState();

  const allHandles = buildAllHandles(config);

  const rssItems = await fetchRssItems(config.feeds, 8);
  const trending = await fetchTrendingTopics(20);

  const enabledBots = BOT_ORDER.filter(k => config.bots[k]);
  if (enabledBots.length === 0) {
    console.error("No bots configured. Set BSKY_<NAME>_HANDLE and BSKY_<NAME>_APP_PASSWORD env vars.");
    process.exit(1);
  }

  const perBotReplyBudget = Math.max(0, Math.floor(config.maxRepliesPerRun / enabledBots.length));
  const perBotPostBudget = Math.max(1, Math.floor(config.maxPostsPerRun / enabledBots.length));

  for (const personaKey of enabledBots) {
    const creds = config.bots[personaKey];
    console.log(`\n== ${personaKey} (${creds.handle}) ==`);

    let agent;
    try {
      agent = await loginAgent(creds);
    } catch (e) {
      console.error(`Login failed for ${personaKey}:`, e?.message ?? e);
      continue;
    }

    // 1) Reply only to opt-in interactions (mentions/replies)
    try {
      const notifs = await listMentions(agent, 30);
      let replied = 0;

      for (const n of notifs) {
        if (replied >= perBotReplyBudget) break;
        if (wasNotificationSeen(state, personaKey, n.uri)) continue;

        // Minimal context. We keep this short to avoid needing heavy post-thread fetching.
        const prompt = n?.record?.text ?? n?.reason ?? "mention";
        const replyText = await composeReply({ personaKey, promptText: prompt, config });

        await replyToUri(agent, n.uri, replyText);
        markNotificationSeen(state, personaKey, n.uri);
        replied++;
        console.log(`Replied to: ${n.uri}`);
      }
    } catch (e) {
      console.warn(`Reply pass failed for ${personaKey}:`, e?.message ?? e);
    }

    // 2) Post at least once per run (this workflow is scheduled at :20)
    for (let i = 0; i < perBotPostBudget; i++) {
      const topic = pickTopicForPersona({ personaKey, items: rssItems, trending, state });
      if (!topic) {
        console.warn("No topic available.");
        break;
      }

      const text = await composePost({ personaKey, topic, config, allHandles });

      try {
        const res = await createPost(agent, text);
        console.log(`Posted: ${res?.uri ?? "(ok)"}`);
        updateSeen(state, personaKey, topic.link ?? `trend:${topic.title.toLowerCase()}`);
        break; // ensure at least one post; don’t spam multiple in a row unless you raise budgets
      } catch (e) {
        console.error(`Post failed for ${personaKey}:`, e?.message ?? e);
        break;
      }
    }
  }

  saveState(state);
  console.log("\nDone.");
}

run().catch((e) => {
  console.error("Fatal:", e?.stack ?? e);
  process.exit(1);
});
