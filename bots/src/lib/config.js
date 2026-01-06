import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const BotEnvSchema = z.object({
  handle: z.string().min(3),
  appPassword: z.string().min(8),
});

const ConfigSchema = z.object({
  timezone: z.string().default("America/Chicago"),
  postMinute: z.number().int().min(0).max(59).default(20),
  openaiApiKey: z.string().optional(),
  openaiModel: z.string().default("gpt-4o-mini"),
  bots: z.record(BotEnvSchema),
  feeds: z.array(z.string().url()).default([]),
  maxPostsPerRun: z.number().int().min(1).max(50).default(7),
  maxRepliesPerRun: z.number().int().min(0).max(30).default(6),
});

/**
 * Optional local config file for dev: bots/src/config.local.json
 * Never commit secrets. In prod (GitHub Actions), use env vars.
 */
function loadLocalConfigFile() {
  const fp = path.resolve(process.cwd(), "src", "config.local.json");
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

export function loadConfig() {
  const local = loadLocalConfigFile() ?? {};

  const feeds = [
    // Religion-focused
    "https://religionnews.com/feed/",
    "https://www.christiantoday.com/rss.xml",
    "https://www.christiantoday.com/world?format=xml",
    "https://www.christiantoday.com/church?format=xml",
    "https://www.catholicnewsagency.com/rss/news.xml",
    "https://www.catholicnewsagency.com/rss/news-vatican.xml",
    // Broader zeitgeist signal (query-driven)
    "https://news.google.com/rss/search?q=religion&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=christianity&hl=en-US&gl=US&ceid=US:en",
  ];

  const bots = {};
  const botKeys = ["RUTH","BRYCE","JERRY","RAYMOND","PARKER","KENNY","ANDREA"];
  for (const key of botKeys) {
    const handle = process.env[`BSKY_${key}_HANDLE`] ?? local?.bots?.[key]?.handle;
    const appPassword = process.env[`BSKY_${key}_APP_PASSWORD`] ?? local?.bots?.[key]?.appPassword;
    if (handle && appPassword) bots[key] = { handle, appPassword };
  }

  const cfg = {
    timezone: process.env.TZ ?? local.timezone ?? "America/Chicago",
    postMinute: Number(process.env.POST_MINUTE ?? local.postMinute ?? 20),
    openaiApiKey: process.env.OPENAI_API_KEY ?? local.openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL ?? local.openaiModel ?? "gpt-4o-mini",
    bots,
    feeds: local.feeds ?? feeds,
    maxPostsPerRun: Number(process.env.MAX_POSTS_PER_RUN ?? local.maxPostsPerRun ?? 7),
    maxRepliesPerRun: Number(process.env.MAX_REPLIES_PER_RUN ?? local.maxRepliesPerRun ?? 6),
  };

  return ConfigSchema.parse(cfg);
}
