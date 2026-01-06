import { PERSONAS, BOT_ORDER } from "./personas.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load the full persona prompts from the text file
const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_PROMPTS_RAW = readFileSync(join(__dirname, "integral_personas.txt"), "utf8");

// Parse persona prompts from the file
function getPersonaPrompt(personaKey) {
    const nameMap = {
        RUTH: "Ruth",
        BRYCE: "Bryce",
        JERRY: "Jerry",
        RAYMOND: "Raymond",
        PARKER: "Parker",
        KENNY: "Kenny",
        ANDREA: "Andrea",
    };
    const name = nameMap[personaKey];
    // Extract the persona section from the file
    const regex = new RegExp(`"${name}":\\s*\`([\\s\\S]*?)\``, "m");
    const match = PERSONA_PROMPTS_RAW.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }
    // Fallback to basic info from PERSONAS
    const p = PERSONAS[personaKey];
    return `You are ${p.id}, an Integral Christianity persona at the "${p.stage}" stage. Voice: ${p.voice}. Stance: ${p.stance.join(" ")}`;
}

// Bluesky max is 300. Keeping a little headroom reduces ugly UI truncation
const MAX_CHARS = 280;

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function clampText(text, max = MAX_CHARS) {
    if (text.length <= max) return text;
    const trimmed = text.slice(0, max - 1);
    const cut = trimmed.lastIndexOf(" ");
    return (cut > 60 ? trimmed.slice(0, cut) : trimmed).trimEnd() + "…";
}

function isLikelyUrl(s) {
    return /^https?:\/\//i.test((s ?? "").trim());
}

function clampPreserveUrl(text, max = MAX_CHARS) {
    const lines = String(text).split("\n");
    const last = lines[lines.length - 1]?.trim();
    if (!last || !isLikelyUrl(last)) return clampText(text, max);

    const url = last;
    const core = lines.slice(0, -1).join("\n").trimEnd();
    const reserved = 1 + url.length;
    const budget = Math.max(40, max - reserved);
    const coreClamped = clampText(core, budget);
    return `${coreClamped}\n${url}`;
}

function safeUrl(u) {
    if (!u) return null;
    if (u.startsWith("trend:")) return null;
    return u;
}

function maybeMentionOtherBot(personaKey, allHandles) {
    if (!allHandles) return "";
    if (Math.random() > 0.18) return "";
    const others = BOT_ORDER.filter(k => k !== personaKey).filter(k => allHandles[k]);
    if (others.length === 0) return "";
    const target = pick(others);
    const callouts = {
        RUTH: ["Want to pray into this with me,", "Thoughts,", "Can you witness this with me,"],
        BRYCE: ["Where do you stand,", "No dodging this,", "Say it plain,"],
        JERRY: ["Help us think carefully,", "How should the Church respond,"],
        RAYMOND: ["What's the mechanism here,", "What data would change your mind,"],
        PARKER: ["Whose voices are missing here,", "How do we protect the vulnerable,"],
        KENNY: ["Altitude check?", "Quadrant scan?", "Stage-collision or policy failure?"],
        ANDREA: ["What does love look like here,", "Can we respond from communion,"],
    };
    const prompt = pick(callouts[personaKey] ?? ["Thoughts,"]);
    return `${prompt} @${allHandles[target]}`;
}

/**
 * Compose a post using OpenAI's Responses API.
 * CRITICAL: This function throws an error if OpenAI fails. No template fallback.
 */
export async function composePost({ personaKey, topic, config, allHandles }) {
    if (!config.openaiApiKey) {
        throw new Error(`OPENAI_API_KEY is not set. Cannot generate post for ${personaKey}.`);
    }

    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const personaPrompt = getPersonaPrompt(personaKey);
    const url = safeUrl(topic.link);
    const mention = maybeMentionOtherBot(personaKey, allHandles);

    const input = [
        personaPrompt,
        "",
        "## Task",
        `Write ONE Bluesky post (max ${MAX_CHARS} characters) reacting to the following news topic.`,
        `Be novel, intuitive, funny, theological, potentially controversial, and delightful.`,
        `Stay completely in character. Your post should sound like something this person would actually say.`,
        "",
        `If a URL is provided, include it on its own line at the end.`,
        `If a mention is provided, include the @handle token exactly as-is (no trailing punctuation).`,
        "",
        `## News Topic`,
        `TITLE: ${topic.title}`,
        `SOURCE: ${topic.source}`,
        url ? `URL: ${url}` : `URL: (none)`,
        mention ? `OPTIONAL_MENTION: ${mention}` : `OPTIONAL_MENTION: (none)`,
    ].join("\n");

    console.log(`[${personaKey}] Calling OpenAI Responses API...`);

    const resp = await client.responses.create({
        model: config.openaiModel,
        input: input,
    });

    let text = resp.output_text?.trim() ?? "";
    if (!text) {
        throw new Error(`OpenAI returned empty response for ${personaKey}.`);
    }

    // Ensure the URL (if any) is present and on its own line at the end.
    if (url && !text.includes(url)) {
        text = `${text}\n${url}`;
    }

    console.log(`[${personaKey}] Generated: ${text.slice(0, 50)}...`);
    return clampPreserveUrl(text);
}

/**
 * Compose a reply using OpenAI's Responses API.
 * CRITICAL: This function throws an error if OpenAI fails. No template fallback.
 */
export async function composeReply({ personaKey, promptText, config }) {
    if (!config.openaiApiKey) {
        throw new Error(`OPENAI_API_KEY is not set. Cannot generate reply for ${personaKey}.`);
    }

    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const personaPrompt = getPersonaPrompt(personaKey);

    const input = [
        personaPrompt,
        "",
        "## Task",
        `Write a thoughtful reply (max ${MAX_CHARS} characters) to someone who tagged you.`,
        `Stay completely in character. Ask one sincere question that reflects your worldview.`,
        "",
        `## Context from the user's post`,
        promptText ?? "(no context provided)",
    ].join("\n");

    console.log(`[${personaKey}] Calling OpenAI Responses API for reply...`);

    const resp = await client.responses.create({
        model: config.openaiModel,
        input: input,
    });

    const text = resp.output_text?.trim() ?? "";
    if (!text) {
        throw new Error(`OpenAI returned empty reply for ${personaKey}.`);
    }

    console.log(`[${personaKey}] Generated reply: ${text.slice(0, 50)}...`);
    return clampText(text);
}
