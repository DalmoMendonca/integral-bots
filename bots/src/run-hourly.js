import { loadConfig } from "./lib/config.js";
import { BOT_ORDER } from "./lib/personas.js";
import { fetchDiverseContent, fetchTrendingTopics, pickTopicForPersona, updateSeen } from "./lib/news.js";
import { composePost, composeReply, getAdaptiveTone } from "./lib/compose.js";
import { loginAgent, createPost, getUnansweredMentions, replyToUri, updatePostMetrics } from "./lib/bsky.js";
import { loadState, saveState, markNotificationSeen } from "./lib/state.js";
import { performanceTracker } from "./lib/learning.js";

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

  console.log(`Starting bot run.`);

  const allHandles = buildAllHandles(config);

  const rssItems = await fetchDiverseContent(8);
  const trending = await fetchTrendingTopics(20);

  const enabledBots = BOT_ORDER.filter(k => config.bots[k]);
  if (enabledBots.length === 0) {
    console.error("No bots configured. Set BSKY_<NAME>_HANDLE and BSKY_<NAME>_APP_PASSWORD env vars.");
    process.exit(1);
  }

  const perBotReplyBudget = Math.max(2, Math.floor(config.maxRepliesPerRun / enabledBots.length));
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

    // 1) Enhanced reply system with priority for bot-to-bot interactions
    try {
      const unansweredMentions = await getUnansweredMentions(agent, personaKey, state, 24);
      let replied = 0;

      console.log(`🎯 Reply loop starting: ${unansweredMentions.length} unanswered mentions, budget: ${perBotReplyBudget}`);

      for (const mention of unansweredMentions) {
        if (replied >= perBotReplyBudget) break;
        
        console.log(`📝 Processing mention ${replied + 1}/${unansweredMentions.length}: ${mention.uri}`);
        
        // Enhanced context with thread awareness - use actual post text
        const prompt = mention.text || mention.reason || "mention";
        console.log(`💭 Prompt text: "${prompt}"`);
        
        // Calculate reply count and conversation depth from state
        const replyCount = state?.bots?.[personaKey]?.repliedTo?.length || 0;
        const conversationDepth = 1; // Could be enhanced by tracking thread depth
        
        try {
          const replyText = await composeReply({ 
            personaKey, 
            promptText: prompt, 
            config,
            isFromBot: mention.isFromBot,
            priority: mention.priority,
            originalPostAuthor: mention.author?.handle,
            originalPostUri: mention.uri,
            replyCount: replyCount,
            conversationDepth: conversationDepth,
            allHandles: allHandles // Pass all bot handles for intelligent selection
          });

          console.log(`✅ Generated reply: "${replyText}"`);

          await replyToUri(agent, mention.uri, replyText, personaKey, getAdaptiveTone(personaKey));
          markNotificationSeen(state, personaKey, mention.uri);
          replied++;
          console.log(`🎉 Successfully replied to ${mention.isFromBot ? 'bot' : 'user'}: ${mention.uri}`);
        } catch (replyError) {
          console.error(`❌ Reply failed for ${mention.uri}:`, replyError?.message ?? replyError);
        }
      }
      
      console.log(`🏁 Reply loop completed: ${replied} replies sent`);
    } catch (e) {
      console.warn(`Reply pass failed for ${personaKey}:`, e?.message ?? e);
    }

    // 2) Update performance metrics before posting
    try {
      await updatePostMetrics(agent, personaKey);
    } catch (e) {
      console.warn(`Metrics update failed for ${personaKey}:`, e?.message ?? e);
    }

    // 3) Post at least once per run with enhanced features
    for (let i = 0; i < perBotPostBudget; i++) {
      const topic = pickTopicForPersona({ personaKey, items: rssItems, trending, state });
      if (!topic) {
        console.warn("No topic available.");
        break;
      }

      const tone = getAdaptiveTone(personaKey);
      const text = await composePost({ personaKey, topic, config, allHandles });

      try {
        const res = await createPost(agent, text, personaKey, tone, topic);
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
