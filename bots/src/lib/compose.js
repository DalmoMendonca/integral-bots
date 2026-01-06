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
    const regex = new RegExp(`"${name}":\\s*\`([\\s\\S]*?)\``, "m");
    const match = PERSONA_PROMPTS_RAW.match(regex);
    if (match && match[1]) {
        return match[1].trim();
    }
    const p = PERSONAS[personaKey];
    return `You are ${p.id}, an Integral Christianity persona at the "${p.stage}" stage. Voice: ${p.voice}. Stance: ${p.stance.join(" ")}`;
}

// Randomized tones/approaches for variety - expanded for more diversity
const TONES = [
    "hot take - bold and provocative challenge to conventional thinking",
    "curious wonder - asking a genuine question from authentic not-knowing",
    "righteous conviction - firm moral stance rooted in deep principle", 
    "gentle adoration - warm and loving appreciation",
    "dry wit - subtle humor that reveals deeper truth",
    "prophetic warning - urgent call to attention with consequences",
    "pastoral comfort - reassuring and supportive presence",
    "philosophical musing - deep but accessible reflection",
    "joyful celebration - enthusiastic praise and gratitude",
    "lament - sorrowful but hopeful mourning",
    "skeptical inquiry - thoughtful doubt seeking understanding",
    "loving confrontation - truth spoken with deep care",
    "mystical awe - wonder at the divine mystery",
    "practical wisdom - actionable advice for daily living",
    "incarnational solidarity - standing with the suffering",
    "kingdom imagination - envisioning God's world as it could be",
    "holy discontent - divine dissatisfaction with status quo",
    "gracious correction - gentle guidance toward truth",
    "eschatological hope - forward-looking anticipation of restoration",
    "incarnational critique - earthly wisdom for heavenly matters"
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Validates that a post contains complete sentences, not truncated thoughts.
 */
export function validateCompleteSentences(text) {
    const trimmed = text.trim();
    
    // Must end with proper punctuation
    if (!/[.!?]$/.test(trimmed)) {
        return false;
    }
    
    // Check for incomplete sentence patterns
    const incompletePatterns = [
        /\b(like|such as|including|for example|for instance)\s*$/, // Ending with examples
        /\b(and|but|or|nor|so|yet|for)\s*$/, // Ending with conjunctions
        /\b(although|because|since|while|whereas|when|if|unless)\s*$/, // Ending with subordinating conjunctions
        /\b(the|a|an|this|that|these|those|my|your|his|her|its|our|their)\s*$/, // Ending with determiners
        /\.\.\.$/, // Ellipses (trailing off)
        /\b(War|As|When|While|Although|Because|If|Since|Being|Like|Such)\s*\w*\s*…\s*$/, // Incomplete starts
        /\b\s*[,:;]\s*$/, // Ending with punctuation that suggests continuation
    ];
    
    for (const pattern of incompletePatterns) {
        if (pattern.test(trimmed)) {
            return false;
        }
    }
    
    // Ensure we have actual content, not just punctuation
    const contentWithoutPunctuation = trimmed.replace(/[.!?]+/g, '').trim();
    if (contentWithoutPunctuation.length < 5) {
        return false;
    }
    
    return true;
}

/**
 * Ensures text completeness by fixing incomplete sentences.
 */
export function ensureCompleteness(text, personaKey) {
    const trimmed = text.trim();
    
    // If already complete, return as-is
    if (validateCompleteSentences(trimmed)) {
        return trimmed;
    }
    
    // Fix incomplete endings based on persona and context
    let fixed = trimmed;
    
    // Fix trailing conjunctions or incomplete phrases first
    const incompleteFixes = [
        { 
            pattern: /\b(and|but|or|nor|so|yet|for)\s*[.!?]*$/gi, 
            replacement: (match) => `${match} this matters deeply.` 
        },
        { 
            pattern: /\b(although|because|since|while|whereas|when|if|unless)\s*[.!?]*$/gi, 
            replacement: (match) => `${match} we must consider the implications.` 
        },
        { 
            pattern: /\b(the|a|an|this|that|these|those)\s*[.!?]*$/gi, 
            replacement: (match) => `${match} demands our attention.` 
        },
        { 
            pattern: /\b(like|such as|including|for example|for instance)\s*[.!?]*$/gi, 
            replacement: (match) => `${match} among other critical concerns.` 
        },
    ];
    
    for (const fix of incompleteFixes) {
        if (fix.pattern.test(fixed)) {
            fixed = fixed.replace(fix.pattern, fix.replacement);
            break;
        }
    }
    
    // Add proper ending if missing
    if (!/[.!?]$/.test(fixed)) {
        if (fixed.includes('?')) {
            fixed += '?';
        } else if (fixed.toLowerCase().includes('war') || fixed.toLowerCase().includes('fight')) {
            fixed += ' and we must address it with courage.';
        } else if (fixed.toLowerCase().match(/^(as|being|like|such)/i)) {
            fixed += ' and here\'s what this means for us.';
        } else if (fixed.toLowerCase().match(/\b(how|why|what|where|when|who|which)\b/i)) {
            fixed += '?';
        } else if (fixed.toLowerCase().match(/\b(because|since|although|while|if|unless)\b/i)) {
            fixed += ' we must act wisely.';
        } else if (fixed.length < 20) {
            fixed += ' this requires our attention.';
        } else {
            fixed += '.';
        }
    }
    
    // Remove any ellipses and complete the thought
    fixed = fixed.replace(/\.\.\./g, '.');
    
    return fixed.trim();
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
 * Compose a post using OpenAI's Responses API with web search.
 * NO CLAMPING - the AI must generate a complete, short post.
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
    const tone = pick(TONES);

    // Calculate exact budget: 300 max - URL length - newline - safety margin
    const urlLength = url ? url.length + 1 : 0; // +1 for newline
    const mentionLength = mention ? mention.length + 1 : 0;
    const textBudget = 300 - urlLength - mentionLength - 5; // 5 char safety margin

    const input = [
        personaPrompt,
        "",
        "## YOUR TASK",
        `Write a SHORT, COMPLETE Bluesky post. Your text MUST be under ${textBudget} characters.`,
        `CRITICAL: Every sentence MUST be complete. NO trailing off with "..." or incomplete thoughts.`,
        `DO NOT end with conjunctions like "and", "but", "because" without finishing the thought.`,
        `DO NOT end with phrases like "As a pastor," or "War without..." - complete your sentences!`,
        "",
        `## TONE FOR THIS POST`,
        `Approach: ${tone}`,
        "",
        `## IMPORTANT CONSTRAINTS`,
        `- You have a HARD LIMIT of ${textBudget} characters for your text (not counting URL).`,
        `- Be punchy, memorable, and authentic to your persona.`,
        `- ACTUALLY READ and engage with the substance of the article content, not just the headline.`,
        `- Use the web_search tool to read the full article before responding.`,
        `- Make it viral-worthy: novel, intuitive, funny, theological, or delightfully controversial.`,
        "",
        `## NEWS TO REACT TO`,
        `TITLE: ${topic.title}`,
        `SOURCE: ${topic.source}`,
        url ? `URL (include this on its own line at the end): ${url}` : `(no URL)`,
        mention ? `OPTIONAL MENTION (include exactly as shown): ${mention}` : `(no mention)`,
        "",
        `## OUTPUT FORMAT`,
        `Just the post text. If there's a URL, put it on its own line at the end.`,
        `If there's a mention, include it naturally in your text.`,
        `ENSURE EVERY SENTENCE IS COMPLETE AND PROPERLY ENDED.`,
    ].join("\n");

    console.log(`[${personaKey}] Calling OpenAI with tone: ${tone}`);

    // Use web_search tool to read the actual article content
    const resp = await client.responses.create({
        model: config.openaiModel,
        input: input,
        tools: [{ type: "web_search" }],
    });

    let text = resp.output_text?.trim() ?? "";
    if (!text) {
        throw new Error(`OpenAI returned empty response for ${personaKey}.`);
    }

    // Validate completeness first, then length
    if (!validateCompleteSentences(text)) {
        console.warn(`[${personaKey}] Post has incomplete sentences, fixing...`);
        text = ensureCompleteness(text, personaKey);
    }

    // Validate length (no clamping - if too long, regenerate with better instructions)
    if (text.length > 300) {
        console.warn(`[${personaKey}] Post too long (${text.length} chars), requesting shorter complete version...`);

        // Try once more with even stricter instructions emphasizing completeness
        const retryResp = await client.responses.create({
            model: config.openaiModel,
            input: `Your previous response was ${text.length} characters and incomplete. Bluesky has a 300 character limit.

REWRITE this to be UNDER 250 characters total while keeping it complete, meaningful, and properly ended:

${text}

REQUIREMENTS:
- Every sentence MUST be complete and properly ended
- NO trailing off with "..." or incomplete thoughts
- End with proper punctuation (., ?, !)
- Keep the core message but make it concise`,
        });

        text = retryResp.output_text?.trim() ?? "";
        
        // Final completeness check
        if (!validateCompleteSentences(text)) {
            text = ensureCompleteness(text, personaKey);
        }
        
        if (!text || text.length > 300) {
            throw new Error(`OpenAI could not generate a complete post under 300 chars for ${personaKey}. Got ${text.length} chars.`);
        }
    }

    console.log(`[${personaKey}] Generated complete post (${text.length} chars): ${text.slice(0, 60)}...`);
    return text;
}

/**
 * Compose a reply using OpenAI's Responses API.
 */
export async function composeReply({ personaKey, promptText, config }) {
    if (!config.openaiApiKey) {
        throw new Error(`OPENAI_API_KEY is not set. Cannot generate reply for ${personaKey}.`);
    }

    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const personaPrompt = getPersonaPrompt(personaKey);
    const tone = pick(TONES);

    const input = [
        personaPrompt,
        "",
        "## YOUR TASK",
        `Write a SHORT, COMPLETE reply (under 280 characters) to someone who tagged you.`,
        `CRITICAL: Every sentence MUST be complete. NO trailing off with "..." or incomplete thoughts.`,
        `DO NOT end with conjunctions like "and", "but", "because" without finishing thought.`,
        `Tone: ${tone}`,
        "",
        "## CONTEXT FROM THE USER'S POST",
        promptText ?? "(no context provided)",
        "",
        "Just output the reply text, nothing else.",
        "ENSURE EVERY SENTENCE IS COMPLETE AND PROPERLY ENDED.",
    ].join("\n");

    console.log(`[${personaKey}] Calling OpenAI for reply with tone: ${tone}`);

    const resp = await client.responses.create({
        model: config.openaiModel,
        input: input,
    });

    const text = resp.output_text?.trim() ?? "";
    if (!text) {
        throw new Error(`OpenAI returned empty reply for ${personaKey}.`);
    }

    // Validate completeness for replies too
    if (!validateCompleteSentences(text)) {
        console.warn(`[${personaKey}] Reply has incomplete sentences, fixing...`);
        text = ensureCompleteness(text, personaKey);
    }

    if (text.length > 300) {
        throw new Error(`Reply too long (${text.length} chars) for ${personaKey}.`);
    }

    console.log(`[${personaKey}] Generated complete reply (${text.length} chars): ${text.slice(0, 60)}...`);
    return text;
}
