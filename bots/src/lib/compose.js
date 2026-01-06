import { PERSONAS, BOT_ORDER } from "./personas.js";

// Bluesky max is 300. Keeping a little headroom reduces ugly UI truncation
// when we append mentions + a URL line.
const MAX_CHARS = 280;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampText(text, max = MAX_CHARS) {
  if (text.length <= max) return text;
  // trim on word boundary
  const trimmed = text.slice(0, max - 1);
  const cut = trimmed.lastIndexOf(" ");
  return (cut > 60 ? trimmed.slice(0, cut) : trimmed).trimEnd() + "…";
}

function isLikelyUrl(s) {
  return /^https?:\/\//i.test((s ?? "").trim());
}

function clampPreserveUrl(text, max = MAX_CHARS) {
  // If the last line is a URL, preserve it and clamp the body instead.
  const lines = String(text).split("\n");
  const last = lines[lines.length - 1]?.trim();
  if (!last || !isLikelyUrl(last)) return clampText(text, max);

  const url = last;
  const core = lines.slice(0, -1).join("\n").trimEnd();
  const reserved = 1 + url.length; // newline + URL
  const budget = Math.max(40, max - reserved);
  const coreClamped = clampText(core, budget);
  return `${coreClamped}\n${url}`;
}

function safeUrl(u) {
  if (!u) return null;
  if (u.startsWith("trend:")) return null;
  return u;
}

function buildTemplatePost({ personaKey, topic, allHandles }) {
  const p = PERSONAS[personaKey];
  const open = pick(p.templates.opener);
  const take = pick(p.templates.take);
  const close = pick(p.templates.closer);

  const url = safeUrl(topic.link);
  const mention = maybeMentionOtherBot(personaKey, allHandles);

  const core = `${open} ${topic.title}\n\n${take} ${mention ? mention + " " : ""}${close}`;
  const withUrl = url ? `${core}\n${url}` : core;
  return clampPreserveUrl(withUrl);
}

function maybeMentionOtherBot(personaKey, allHandles) {
  if (!allHandles) return "";
  if (Math.random() > 0.18) return "";
  const others = BOT_ORDER.filter(k => k !== personaKey).filter(k => allHandles[k]);
  if (others.length === 0) return "";
  const target = pick(others);
  // tag with a "come debate me" energy depending on stage
  const callouts = {
    RUTH: ["Want to pray into this with me,", "Thoughts,", "Can you witness this with me,"],
    BRYCE: ["Where do you stand,", "No dodging this,", "Say it plain,"],
    JERRY: ["Help us think carefully,", "How should the Church respond,"],
    RAYMOND: ["What’s the mechanism here,", "What data would change your mind,"],
    PARKER: ["Whose voices are missing here,", "How do we protect the vulnerable,"],
    KENNY: ["Altitude check?", "Quadrant scan?", "Stage-collision or policy failure?"],
    ANDREA: ["What does love look like here,", "Can we respond from communion,"],
  };
  const prompt = pick(callouts[personaKey] ?? ["Thoughts,"]);
  // IMPORTANT: keep the @handle token clean (no trailing punctuation)
  // so RichText.detectFacets can turn it into a real mention facet.
  return `${prompt} @${allHandles[target]}`;
}

/** Optional OpenAI: if you set OPENAI_API_KEY, we’ll use it.
 * If not, we fall back to templates (free).
 */
export async function composePost({ personaKey, topic, config, allHandles }) {
  if (config.openaiApiKey) {
    try {
      const { OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: config.openaiApiKey });
      const p = PERSONAS[personaKey];

      const url = safeUrl(topic.link);
      const mention = maybeMentionOtherBot(personaKey, allHandles);

      const sys = [
        `You are ${p.id}, an Integral Christianity persona at the "${p.stage}" stage.`,
        `Voice: ${p.voice}.`,
        `Stance: ${p.stance.join(" ")}`,
        `Constraints: respectful; no slurs; no harassment; no sexual content; no doxxing; no medical/legal instructions.`,
        `Write ONE Bluesky post max ${MAX_CHARS} characters.`,
        `If a URL is provided, include it on its own line at the end.`,
        `If a mention is provided, include the @handle token exactly as-is (no trailing punctuation like '?' or ',').`,
      ].join("\n");

      const user = [
        `React to this topic in your voice:`,
        `TITLE: ${topic.title}`,
        `SOURCE: ${topic.source}`,
        url ? `URL: ${url}` : `URL: (none)`,
        mention ? `OPTIONAL_MENTION: ${mention}` : `OPTIONAL_MENTION: (none)`,
      ].join("\n");

      const resp = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.9,
      });

      let text = resp.choices?.[0]?.message?.content?.trim() ?? "";
      if (text) {
        // Ensure the URL (if any) is present and on its own line at the end.
        if (url && !text.includes(url)) text = `${text}\n${url}`;
        return clampPreserveUrl(text);
      }
    } catch {
      // fall through to template
    }
  }

  return buildTemplatePost({ personaKey, topic, allHandles });
}

export async function composeReply({ personaKey, promptText, config }) {
  const p = PERSONAS[personaKey];
  const base = `${pick(p.templates.opener)} ${pick(p.templates.take)} ${pick(p.templates.closer)}`;

  if (config.openaiApiKey) {
    try {
      const { OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: config.openaiApiKey });

      const sys = [
        `You are ${p.id}, an Integral Christianity persona at the "${p.stage}" stage.`,
        `Voice: ${p.voice}.`,
        `Stance: ${p.stance.join(" ")}`,
        `Constraints: respectful; opt-in interaction; max ${MAX_CHARS} chars; ask one sincere question.`,
      ].join("\n");

      const user = [
        `Write a reply to a user who tagged you.`,
        `Context (may be short): ${promptText ?? ""}`,
      ].join("\n");

      const resp = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.9,
      });

      const text = resp.choices?.[0]?.message?.content?.trim() ?? "";
      if (text) return clampText(text);
    } catch {
      // ignore
    }
  }

  // free fallback: short + one question
  const q = {
    RUTH: "How can I pray with you about this?",
    BRYCE: "What action do you think faithfulness requires here?",
    JERRY: "What would obedience look like this week?",
    RAYMOND: "What evidence would shift your view?",
    PARKER: "Who is being harmed or unheard here?",
    KENNY: "Which quadrant are we missing in this take?",
    ANDREA: "Where do you feel God inviting a softer response?",
  }[personaKey] ?? "What do you think is the wisest next step?";

  return clampText(`${base} ${q}`);
}
