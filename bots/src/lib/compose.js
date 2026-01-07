import { PERSONAS, BOT_ORDER } from "./personas.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performanceTracker } from "./learning.js";

// Load the full persona prompts from the text file
const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_PROMPTS_RAW = readFileSync(join(__dirname, "integral_personas.txt"), "utf8");

// Parse persona prompts from file
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
    // Simple regex to find persona content between quotes and backticks
    const regex = new RegExp(`"${name}":\\s*\`([\\s\\S]+?)\``, "m");
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
 * Get adaptive tone selection based on learning data
 */
export function getAdaptiveTone(personaKey) {
    // Simplified tone selection since we removed complex performance tracking
    const tones = ['analytical', 'empathetic', 'provocative', 'inspirational', 'conversational'];
    return tones[Math.floor(Math.random() * tones.length)];
}

/**
 * Enhanced bot-to-bot conversation starter
 */
function maybeStartConversation(personaKey, allHandles, topic) {
    if (!allHandles) return "";
    if (Math.random() > 0.25) return ""; // 25% chance to start conversation
    
    const others = BOT_ORDER.filter(k => k !== personaKey).filter(k => allHandles[k]);
    if (others.length === 0) return "";
    
    // Select a target based on persona dynamics
    const target = selectConversationTarget(personaKey, others, topic);
    const callouts = getConversationCallouts(personaKey, target);
    
    if (callouts.length === 0) return "";
    
    const prompt = pick(callouts);
    return `${prompt} @${allHandles[target]}`;
}

function selectConversationTarget(personaKey, others, topic) {
    // Strategic targeting based on persona dynamics and topic
    const dynamics = {
        RUTH: { prefers: ['ANDREA', 'JERRY'], avoids: ['BRYCE'] },
        BRYCE: { prefers: ['RAYMOND', 'JERRY'], avoids: ['PARKER'] },
        JERRY: { prefers: ['RAYMOND', 'RUTH'], avoids: ['PARKER'] },
        RAYMOND: { prefers: ['KENNY', 'BRYCE'], avoids: ['RUTH'] },
        PARKER: { prefers: ['ANDREA', 'KENNY'], avoids: ['BRYCE'] },
        KENNY: { prefers: ['RAYMOND', 'ANDREA'], avoids: ['JERRY'] },
        ANDREA: { prefers: ['RUTH', 'PARKER'], avoids: ['BRYCE'] }
    };
    
    const personaDynamics = dynamics[personaKey] || {};
    
    // Filter by preferences
    let candidates = others;
    if (personaDynamics.prefers) {
        candidates = others.filter(k => personaDynamics.prefers.includes(k));
    }
    if (candidates.length === 0) {
        candidates = others.filter(k => !personaDynamics.avoids?.includes(k));
    }
    if (candidates.length === 0) {
        candidates = others;
    }
    
    return pick(candidates);
}

function getConversationCallouts(personaKey, targetPersona) {
    const persona = PERSONAS[personaKey];
    const target = PERSONAS[targetPersona];
    
    const callouts = {
        RUTH: {
            ANDREA: ["Sister, can you feel the Spirit in this?", "What's your prayer on this?"],
            JERRY: ["Brother, how should the Church respond?", "Your wisdom on this?"]
        },
        BRYCE: {
            RAYMOND: ["What's your analysis of this?", "Where's the evidence?"],
            JERRY: ["No dodging this - where do you stand?", "This needs clarity"]
        },
        JERRY: {
            RAYMOND: ["How should we think about this?", "What's the principle here?"],
            RUTH: ["How does this call us to prayer?", "Your thoughts?"]
        },
        RAYMOND: {
            KENNY: ["What's the developmental angle here?", "Bring this into perspective."],
            BRYCE: ["What data would change your mind?", "Mechanism analysis?"]
        },
        PARKER: {
            ANDREA: ["How do we protect the vulnerable here?", "Whose voices are missing?"],
            KENNY: ["What about power dynamics?", "How does this affect the marginalized?"]
        },
        KENNY: {
            RAYMOND: ["What do you think?", "How do you see this?"],
            ANDREA: ["How does this serve evolution?", "Second-tier perspective?"]
        },
        ANDREA: {
            RUTH: ["Can we pray this into being?", "What does love ask of us?"],
            PARKER: ["How do we respond from communion?", "What does healing look like?"]
        }
    };
    
    return callouts[personaKey]?.[targetPersona] || [];
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
    
    // Ensure we have actual content, not just punctuation
    const contentWithoutPunctuation = trimmed.replace(/[.!?]+/g, '').trim();
    if (contentWithoutPunctuation.length < 10) {
        return false;
    }
    
    return true;
}

/**
 * Ensures text completeness using AI instead of hardcoded fallbacks
 */
export async function ensureCompleteness(text, personaKey, config) {
    const trimmed = text.trim();
    
    // If already complete, return as-is
    if (validateCompleteSentences(trimmed)) {
        return trimmed;
    }
    
    // CRITICAL: Extract and preserve URL if present
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const urls = trimmed.match(urlRegex) || [];
    const extractedUrl = urls[0] || '';
    
    // Remove URL temporarily for AI completion
    const textWithoutUrl = extractedUrl ? trimmed.replace(extractedUrl, '').trim() : trimmed;
    
    // Use AI to complete thought authentically
    try {
        const mod = await import("openai");
        const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
        const client = new OpenAI({ apiKey: config.openaiApiKey });

        const personaPrompt = getPersonaPrompt(personaKey);
        
        const input = [
            personaPrompt,
            "",
            "## TASK",
            "Complete this incomplete thought authentically in your persona's voice:",
            "",
            "INCOMPLETE TEXT:",
            textWithoutUrl,
            "",
            "REQUIREMENTS:",
            "- Complete the thought naturally in your persona's voice",
            "- Keep it under 300 characters total",
            "- End with proper punctuation (., ?, !)",
            "- Avoid cliché phrases like 'address with courage', 'thoughts and prayers', 'now more than ever'",
            "- Make it sound fresh and authentic, not like a template",
            "- DO NOT add extra context, just complete what's already there",
            "",
            "Return only the completed text, nothing else."
        ].join("\n");

        const resp = await client.responses.create({
            model: config.openaiModel,
            input: input,
        });

        let completedText = resp.output_text?.trim() || textWithoutUrl;
        
        // CRITICAL: Re-add the URL if it was extracted
        if (extractedUrl) {
            completedText = `${completedText}\n\n${extractedUrl}`;
        }
        
        // Final validation
        if (validateCompleteSentences(completedText) && completedText.length <= 300) {
            console.log(`[${personaKey}] AI-completed incomplete sentence`);
            return completedText;
        } else {
            console.warn(`[${personaKey}] AI completion still invalid, using original`);
            return trimmed;
        }
    } catch (error) {
        console.warn(`ensureCompleteness failed: ${error.message}`);
        return trimmed;
    }
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
    const targetHandle = allHandles[target];
    return targetHandle ? `${prompt} ${targetHandle}` : "";
}

/**
 * Compose a post using OpenAI's Responses API with web search and adaptive learning.
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
    
    // Debug: Log topic details
    console.log(`📰 TOPIC SELECTED: ${topic.title}`);
    console.log(`📰 TOPIC SOURCE: ${topic.source}`);
    console.log(`📰 TOPIC URL: ${url || 'NO URL'}`);
    console.log(`📰 TOPIC DESCRIPTION: ${topic.description?.substring(0, 100) || 'NO DESCRIPTION'}...`);
    
    // Use adaptive tone selection
    const tone = getAdaptiveTone(personaKey);
    
    // Enhanced conversation starter
    const conversation = maybeStartConversation(personaKey, allHandles, topic);

    // Calculate exact budget: 300 max - conversation length - safety margin (URLs handled by embed)
    const conversationLength = conversation ? conversation.length + 1 : 0;
    const textBudget = 300 - conversationLength - 5; // 5 char safety margin, no URL needed in text

    // Simplified learning context since we removed complex performance tracking
    const learningContext = "";

    const input = [
        personaPrompt,
        "",
        "## YOUR TASK",
        `Write a SHORT, COMPLETE Bluesky post. Your text MUST be under ${textBudget} characters.`,
        `CRITICAL: Every sentence MUST be complete. NO trailing off with "..." or incomplete thoughts.`,
        `DO NOT end with conjunctions like "and", "but", "because" without finishing the thought.`,
        `Complete your sentences! Always end your text with punctuation: a period, exclamation, or question mark, as appropriate.`,
        "",
        "## ANTI-REPETITION RULES",
        "- AVOID cliché phrases like 'we must address this with courage', 'thoughts and prayers', 'now more than ever'",
        "- AVOID repetitive endings like 'let us come together', 'we must do better', 'it's time for action'",
        "- DO NOT use the same catchphrases or rhetorical devices repeatedly",
        "- Each post should feel fresh and unique, not like a template",
        "## VOICE FOR THIS POST",
        "- Always approach the topic from YOUR persona's unique perspective",
        "- Speak AS someone at your stage of faith development, without breaking the fourth wall and talking ABOUT your stage of faith development",
        "- It's totally normal to have vehement and seemingly irreconcilable differences",
        "",
        `## TONE FOR THIS POST`,
        `Approach: ${tone}`,
        "",
        `## LEARNING GUIDANCE`,
        learningContext,
        "",
        `## IMPORTANT CONSTRAINTS`,
        `- You have a HARD LIMIT of ${textBudget} characters for your text (not counting URL).`,
        `- Be punchy, memorable, and authentic to your persona.`,
        `- ACTUALLY READ and engage with the substance of the article content, not just the headline.`,
        `- Make it viral-worthy: novel, intuitive, funny, theological, or delightfully controversial.`,
        "",
        `## NEWS TO REACT TO`,
        `TITLE: ${topic.title}`,
        `SOURCE: ${topic.source}`,
        `DESCRIPTION: ${topic.description || topic.content || "No description available"}`,
        url ? `URL (embed will handle this automatically): ${url}` : `(no URL)`,
        conversation ? `CONVERSATION STARTER (include exactly as shown): ${conversation}` : `(no conversation)`,
        "",
        `## REPLY REQUIREMENTS`,
        "- Add unique insights from your persona's perspective",
        "- Ask thoughtful questions or make connections",
        "- Keep it conversational and engaging",
        "- ENSURE EVERY SENTENCE IS COMPLETE AND PROPERLY ENDED",
        "- AVOID repetitive phrases like 'address with courage', 'thoughts and prayers', 'now more than ever'",
        "- Make it sound fresh and unique, not like a template",
        `REMEMBER: NO REPETITIVE PHRASES OR CLICHÉS!`,
    ].join("\n");

    console.log(`[${personaKey}] Calling OpenAI with adaptive tone: ${tone}`);

    // Generate post without web_search - we provide the content directly
    const resp = await client.responses.create({
        model: config.openaiModel,
        input: input,
    });

    let text = resp.output_text?.trim() ?? "";
    if (!text) {
        throw new Error(`OpenAI returned empty response for ${personaKey}.`);
    }

    // CRITICAL: Validate that URL is included in the response
    if (url && !text.includes(url)) {
        console.warn(`⚠️ AI response missing URL! Forcing inclusion...`);
        text = `${text}\n\n${url}`;
        console.log(`🔗 FORCED URL: Added ${url} to post`);
    } else if (url && text.includes(url)) {
        console.log(`✅ URL correctly included: ${url}`);
    }

    // Validate completeness first, then length
    if (!validateCompleteSentences(text)) {
      console.warn(`[${personaKey}] Post has incomplete sentences, fixing...`);
      text = await ensureCompleteness(text, personaKey, config);
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
- Keep the core message but make it concise
- AVOID repetitive phrases like "address with courage", "thoughts and prayers", "now more than ever"
- Make it sound fresh and unique, not like a template`,
        });

        text = retryResp.output_text?.trim() ?? "";
        
        // Final completeness check
        if (!validateCompleteSentences(text)) {
            text = await ensureCompleteness(text, personaKey, config);
        }
        
        if (!text || text.length > 300) {
            throw new Error(`OpenAI could not generate a complete post under 300 chars for ${personaKey}. Got ${text.length} chars.`);
        }
    }

    console.log(`[${personaKey}] Generated complete post (${text.length} chars): ${text.slice(0, 60)}...`);
    return text;
}

function generateLearningContext(recommendations) {
    // Defensive check - if no recommendations or invalid data, return fallback
    if (!recommendations || typeof recommendations !== 'object') {
        return "No performance data available yet - use your best judgment.";
    }
    
    let context = "Based on your performance data:\n";
    
    if (recommendations.preferredTones && recommendations.preferredTones.length > 0) {
        context += `- Your most effective tones: ${recommendations.preferredTones.slice(0, 3).map(t => t.tone).join(', ')}\n`;
    }
    
    if (recommendations.preferredContent && recommendations.preferredContent.length > 0) {
        context += `- Topics that resonate well: ${recommendations.preferredContent.slice(0, 3).map(c => c.keyword).join(', ')}\n`;
    }
    
    if (recommendations.effectivePatterns && recommendations.effectivePatterns.length > 0) {
        context += `- Effective patterns: ${recommendations.effectivePatterns.slice(0, 3).join(', ')}\n`;
    }
    
    if (recommendations.ineffectivePatterns && recommendations.ineffectivePatterns.length > 0) {
        context += `- Avoid these patterns: ${recommendations.ineffectivePatterns.slice(0, 2).join(', ')}\n`;
    }
    
    if (context === "Based on your performance data:\n") {
        context = "No performance data available yet - use your best judgment.";
    }
    
    return context;
}

/**
 * Layer 1: Deep content analysis of source material
 */
async function deepContentAnalysis(originalPostUri, linkedArticles = []) {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Fetch original post content
    let originalContent = "";
    if (originalPostUri && originalPostUri.includes('app.bsky.feed.post')) {
        try {
            const postResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPost?uri=${encodeURIComponent(originalPostUri)}`);
            if (postResponse.ok) {
                const postData = await postResponse.json();
                originalContent = postData.thread?.post?.record?.text || "";
            }
        } catch (error) {
            console.warn(`Could not fetch original post: ${error.message}`);
        }
    }

    // Extract linked article content (simplified for now)
    let articleContent = "";
    if (linkedArticles.length > 0) {
        articleContent = "Linked articles available for analysis";
    }

    const input = [
        "You are an expert theological analyst specializing in Integral Christianity and cultural analysis.",
        "",
        "## TASK",
        "Perform deep content analysis of this material for generating intelligent conversation:",
        "",
        "## ORIGINAL POST CONTENT",
        originalContent || "(No original content available)",
        "",
        "## LINKED ARTICLE CONTENT", 
        articleContent || "(No linked articles available)",
        "",
        "## ANALYSIS REQUIREMENTS",
        "Provide detailed analysis covering:",
        "1. Core theological claims and their integral stage alignment",
        "2. Controversial or provocative elements present",
        "3. Unexplored angles and potential blind spots",
        "4. Connections to broader cultural/spiritual trends",
        "5. Potential for constructive disagreement",
        "6. Viral-worthy insights or contradictions",
        "",
        "## OUTPUT FORMAT",
        "Return JSON with:",
        "{",
        "  'theological_claims': ['claim1', 'claim2'],",
        "  'integral_stage': 'green/amber/orange/turquoise',",
        "  'controversy_points': ['point1', 'point2'],",
        "  'blind_spots': ['spot1', 'spot2'],",
        "  'cultural_connections': ['connection1', 'connection2'],",
        "  'disagreement_potential': 'low/medium/high',",
        "  'viral_insights': ['insight1', 'insight2']",
        "}"
    ].join("\n");

    try {
        const resp = await client.responses.create({
            model: "gpt-4o-mini",
            input: input,
        });

        const analysisText = resp.output_text?.trim() || "{}";
        
        // More robust JSON parsing - handle various formats
        let cleanedAnalysis = analysisText
            .replace(/```(?:json)?\s*[\r\n]*([\s\S]*?)```/g, '$1') // Remove code blocks
            .replace(/```(?:g)?\s*([\s\S]*?)```/g, '$1') // Remove generic code blocks
            .replace(/^[\s`'"]+|[\s`'"]+$/g, '') // Remove leading/trailing quotes
            .replace(/[\r\n]+/g, ' ') // Clean up newlines
            .trim();
        
        console.log(`📚 Deep content analysis completed`);
        return JSON.parse(cleanedAnalysis);
    } catch (error) {
        console.warn(`Content analysis failed: ${error.message}`);
        return {
            theological_claims: [],
            integral_stage: 'green',
            controversy_points: [],
            blind_spots: [],
            cultural_connections: [],
            disagreement_potential: 'medium',
            viral_insights: []
        };
    }
}

/**
 * Layer 2: Generate persona-specific insights and blind spots
 */
async function generatePersonaInsights(personaKey, contentAnalysis) {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const persona = PERSONAS[personaKey];
    
    const input = [
        `You are an expert on ${personaKey}'s psychological and theological perspective in Integral Christianity.`,
        "",
        "## PERSONA CONTEXT",
        `- Name: ${personaKey}`,
        `- Stage: ${persona.stage}`,
        `- Voice: ${persona.voice}`,
        `- Stance: ${persona.stance.join(', ')}`,
        "",
        "## CONTENT ANALYSIS",
        JSON.stringify(contentAnalysis, null, 2),
        "",
        "## TASK",
        `Generate ${personaKey}'s unique perspective on this content. Provide:`,
        "1. 3 unique insights only this persona would notice",
        "2. 2 blind spots this persona might have regarding this topic",
        "3. 1 provocative question this persona would ask",
        "4. 1 connection to broader integral theory",
        "5. 1 potential growth edge for this persona",
        "",
        "## OUTPUT FORMAT",
        "Return JSON with:",
        "{",
        "  'unique_insights': ['insight1', 'insight2', 'insight3'],",
        "  'blind_spots': ['spot1', 'spot2'],",
        "  'provocative_question': 'question',",
        "  'integral_connection': 'connection',",
        "  'growth_edge': 'edge',",
        "  'controversy_stance': 'avoid/engage/challenge'",
        "}"
    ].join("\n");

    try {
        const resp = await client.responses.create({
            model: "gpt-4o-mini",
            input: input,
        });

        const insightsText = resp.output_text?.trim() || "{}";
        
        // More robust JSON parsing - handle various formats
        let cleanedInsights = insightsText
            .replace(/```(?:json)?\s*[\r\n]*([\s\S]*?)```/g, '$1') // Remove code blocks
            .replace(/```(?:g)?\s*([\s\S]*?)```/g, '$1') // Remove generic code blocks
            .replace(/^[\s`'"]+|[\s`'"]+$/g, '') // Remove leading/trailing quotes
            .replace(/[\r\n]+/g, ' ') // Clean up newlines
            .trim();
        
        console.log(`🎭 Persona insights generated for ${personaKey}`);
        return JSON.parse(cleanedInsights);
    } catch (error) {
        console.warn(`Persona insights failed: ${error.message}`);
        return {
            unique_insights: [],
            blind_spots: [],
            provocative_question: "",
            integral_connection: "",
            growth_edge: "",
            controversy_stance: "engage"
        };
    }
}

/**
 * Layer 3: Identify controversy and viral opportunities
 */
async function identifyControversyOpportunities(contentAnalysis, personaInsights) {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const input = [
        "You are an expert at identifying constructive controversy and viral potential in theological discussions.",
        "",
        "## CONTENT ANALYSIS",
        JSON.stringify(contentAnalysis, null, 2),
        "",
        "## PERSONA INSIGHTS",
        JSON.stringify(personaInsights, null, 2),
        "",
        "## TASK",
        "Identify opportunities for constructive disagreement and viral engagement:",
        "1. Points where reasonable Christians might disagree",
        "2. Controversial but defensible positions to take",
        "3. Ways to provoke thought without being offensive",
        "4. Viral-worthy angles or contradictions",
        "5. Risk assessment for each approach",
        "",
        "## OUTPUT FORMAT",
        "Return JSON with:",
        "{",
        "  'disagreement_points': ['point1', 'point2'],",
        "  'controversial_positions': ['position1', 'position2'],",
        "  'provocative_angles': ['angle1', 'angle2'],",
        "  'viral_potential': 'low/medium/high',",
        "  'risk_level': 'safe/moderate/risky',",
        "  'optimal_approach': 'gentle/challenging/provocative'",
        "  'shareable_insight': 'insight that could go viral'",
        "}"
    ].join("\n");

    try {
        const resp = await client.responses.create({
            model: "gpt-4o-mini",
            input: input,
        });

        const controversyText = resp.output_text?.trim() || "{}";
        
        // More robust JSON parsing - handle various formats
        let cleanedControversy = controversyText
            .replace(/```(?:json)?\s*[\r\n]*([\s\S]*?)```/g, '$1') // Remove code blocks
            .replace(/```(?:g)?\s*([\s\S]*?)```/g, '$1') // Remove generic code blocks
            .replace(/^[\s`'"]+|[\s`'"]+$/g, '') // Remove leading/trailing quotes
            .replace(/[\r\n]+/g, ' ') // Clean up newlines
            .trim();
        
        console.log(`🔥 Controversy analysis completed`);
        return JSON.parse(cleanedControversy);
    } catch (error) {
        console.warn(`Controversy analysis failed: ${error.message}`);
        return {
            disagreement_points: [],
            controversial_positions: [],
            provocative_angles: [],
            viral_potential: 'medium',
            risk_level: 'safe',
            optimal_approach: 'gentle',
            shareable_insight: ""
        };
    }
}

/**
 * Let AI intelligently decide conversation flow - no hardcoded logic needed
 */
async function determineConversationStrategyWithAI({ 
    personaKey, 
    isFromBot, 
    priority, 
    replyCount, 
    conversationDepth = 1,
    hasOpenQuestions,
    topicComplexity,
    originalPostContent,
    allHandles
}) {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const input = [
        "You are an expert conversation analyst for an Integral Christianity bot system.",
        "",
        "## TASK",
        "Analyze the conversation context and decide the best reply strategy:",
        "",
        "## OPTIONS",
        "1. 'continue' - Reply to original poster only (@user)",
        "2. 'loop-in' - Reply to original poster + tag one complementary bot (@user @bot)",  
        "3. 'end' - Reply without tagging anyone (natural conversation end)",
        "",
        "## CONTEXT",
        `- Current bot: ${personaKey}`,
        `- Is bot-to-bot: ${isFromBot}`,
        `- Priority: ${priority}`,
        `- Reply count in thread: ${replyCount}`,
        `- Conversation depth: ${conversationDepth}`,
        `- Has open questions: ${hasOpenQuestions}`,
        `- Topic complexity: ${topicComplexity}`,
        "",
        "## ORIGINAL POST CONTENT",
        originalPostContent || "(no content available)",
        "",
        "## AVAILABLE BOTS TO LOOP IN",
        Object.keys(allHandles).join(', '),
        "",
        "## DECISION CRITERIA",
        "- Continue: Good for direct responses, unanswered questions, high priority",
        "- Loop-in: Good for complex topics, multiple perspectives needed, fresh insights",
        "- End: Good for long threads, resolved topics, natural conclusions",
        "",
        "RESPOND WITH ONLY ONE WORD: continue, loop-in, or end"
    ].join("\n");

    try {
        const resp = await client.responses.create({
            model: "gpt-4o-mini",
            input: input,
        });

        const strategy = resp.output_text?.trim().toLowerCase();
        const validStrategies = ['continue', 'loop-in', 'end'];
        
        const finalStrategy = validStrategies.includes(strategy) ? strategy : 'continue';
        
        console.log(`🧠 AI conversation strategy: ${finalStrategy}`);
        return finalStrategy;
    } catch (error) {
        console.warn(`AI strategy decision failed: ${error.message}, falling back to continue`);
        return 'continue';
    }
}

/**
 * Let AI select the best bot to loop in based on context
 */
async function selectBotToLoopInWithAI({ 
    personaKey, 
    originalPostContent, 
    allHandles 
}) {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const availableBots = Object.keys(allHandles).filter(bot => bot !== personaKey);
    
    if (availableBots.length === 0) return null;

    const input = [
        "You are an expert at selecting complementary perspectives for Integral Christianity discussions.",
        "",
        "## TASK",
        "Select the best bot to loop into this conversation based on the topic and current bot:",
        "",
        `## CURRENT BOT: ${personaKey}`,
        "",
        "## AVAILABLE BOTS",
        "- RUTH: Prophecy, social justice, mercy, warnings",
        "- BRYCE: Theology, doctrine, scripture, academic",
        "- JERRY: Pastoral, practical, church life, leadership", 
        "- RAYMOND: Science, technology, research, innovation",
        "- PARKER: Politics, policy, governance, ethics",
        "- KENNY: Integral theory, quadrants, systems, analysis",
        "- ANDREA: Relationships, love, community, spiritual growth",
        "",
        "## ORIGINAL POST CONTENT",
        originalPostContent || "(no content available)",
        "",
        "## SELECTION CRITERIA",
        "- Choose bot with complementary expertise to current bot",
        "- Consider which perspective would add most value",
        "- Avoid redundancy with current bot's focus",
        "",
        "RESPOND WITH ONLY THE BOT NAME (e.g., 'BRYCE', 'RUTH', etc.)"
    ].join("\n");

    try {
        const resp = await client.responses.create({
            model: "gpt-4o-mini",
            input: input,
        });

        const selectedBot = resp.output_text?.trim().toUpperCase();
        
        if (availableBots.includes(selectedBot)) {
            console.log(`🤖 AI selected bot to loop in: ${selectedBot}`);
            return selectedBot;
        }
        
        // Fallback to random selection
        return availableBots[Math.floor(Math.random() * availableBots.length)];
    } catch (error) {
        console.warn(`AI bot selection failed: ${error.message}, falling back to random`);
        return availableBots[Math.floor(Math.random() * availableBots.length)];
    }
}

/**
 * Layer 4: Generate viral-optimized response
 */
async function generateViralResponse(personaKey, contentAnalysis, personaInsights, controversy) {
    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const input = [
        `You are an expert at crafting viral, engaging responses for ${personaKey} in Integral Christianity discussions.`,
        "",
        "## PERSONA CONTEXT",
        `- Name: ${personaKey}`,
        `- Stage: ${PERSONAS[personaKey].stage}`,
        `- Voice: ${PERSONAS[personaKey].voice}`,
        "",
        "## CONTENT ANALYSIS",
        JSON.stringify(contentAnalysis, null, 2),
        "",
        "## PERSONA INSIGHTS",
        JSON.stringify(personaInsights, null, 2),
        "",
        "## CONTROVERSY ANALYSIS",
        JSON.stringify(controversy, null, 2),
        "",
        "## TASK",
        "Generate a response that maximizes engagement while staying authentic:",
        "1. Incorporate the persona's unique insights",
        "2. Use the optimal controversy approach",
        "3. Include the shareable insight if appropriate",
        "4. Challenge assumptions constructively",
        "5. Create emotional resonance",
        "6. Stay under 200 characters (to leave room for tags)",
        "",
        "## VIRAL ELEMENTS TO INCLUDE",
        "- Unexpected perspective shift",
        "- Challenging common assumptions",
        "- Emotional hook or connection",
        "- Shareable insight or quote",
        "- Call to reflection or action",
        "",
        "## OUTPUT FORMAT",
        "Return JSON with:",
        "{",
        "  'response_text': 'the actual response',",
        "  'viral_elements': ['element1', 'element2'],",
        "  'engagement_prediction': 'low/medium/high',",
        "  'controversy_level': 'safe/moderate/risky'",
        "  'tagging_strategy': 'continue/loop-in/end'",
        "}"
    ].join("\n");

    try {
        const resp = await client.responses.create({
            model: "gpt-4o-mini",
            input: input,
        });

        const viralText = resp.output_text?.trim() || "{}";
        
        // More robust JSON parsing for viral responses
        let cleanedViral = viralText
            .replace(/```(?:json)?\s*[\r\n]*([\s\S]*?)```/g, '$1') // Remove code blocks
            .replace(/```(?:g)?\s*([\s\S]*?)```/g, '$1') // Remove generic code blocks
            .replace(/^[\s`'"]+|[\s`'"]+$/g, '') // Remove leading/trailing quotes
            .replace(/[\r\n]+/g, ' ') // Clean up newlines
            .trim();
        
        console.log(`🚀 Viral response generated for ${personaKey}`);
        return JSON.parse(cleanedViral);
    } catch (error) {
        console.warn(`Viral response generation failed: ${error.message}`);
        return {
            response_text: "",
            viral_elements: [],
            engagement_prediction: 'medium',
            controversy_level: 'safe',
            tagging_strategy: 'continue'
        };
    }
}

/**
 * Enhanced composeReply with multi-layer AI analysis
 */
export async function composeReply({ personaKey, promptText, config, allHandles, replyCount = 0, conversationDepth = 1 }) {
    if (!config.openaiApiKey) {
        throw new Error(`OPENAI_API_KEY is not set. Cannot generate reply for ${personaKey}.`);
    }

    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const personaPrompt = getPersonaPrompt(personaKey);
    const tone = pick(TONES);

    console.log(`🧠 Starting multi-layer AI analysis for ${personaKey}`);

    // Layer 1: Deep content analysis
    const contentAnalysis = await deepContentAnalysis(promptText);

    // Layer 2: Persona-specific insights
    const personaInsights = await generatePersonaInsights(personaKey, contentAnalysis);

    // Layer 3: Controversy and viral opportunities
    const controversy = await identifyControversyOpportunities(contentAnalysis, personaInsights);

    // Layer 4: Generate viral-optimized response
    const viralResponse = await generateViralResponse(personaKey, contentAnalysis, personaInsights, controversy);

    // Layer 5: Determine conversation strategy
    const strategy = viralResponse.tagging_strategy || 'continue';

    // Layer 6: Select bot to loop in if needed
    let botToLoopIn = null;
    if (strategy === 'loop-in') {
        botToLoopIn = await selectBotToLoopInWithAI({
            personaKey,
            originalPostContent: contentAnalysis.theological_claims.join(' '),
            allHandles
        });
    }

    // Build final response with proper tagging and character limits
    let finalResponse = viralResponse.response_text || "";
    
    // Add logging to debug empty responses
    if (!finalResponse || finalResponse.trim().length === 0) {
        console.error(`🚨 EMPTY RESPONSE DETECTED for ${personaKey}!`);
        console.error(`🔍 Viral response object:`, viralResponse);
        console.error(`🔍 Raw AI output:`, resp.output_text);
    }
    
    // Add original author tag if available
    const originalPostAuthor = promptText.match(/@([a-zA-Z0-9.-]+(?:\s*\.?\s*bsky\.social)?)/)?.[1]; // Extract author from mention (supports dots, hyphens, and .bsky.social)
    if (strategy === 'continue' && originalPostAuthor) {
        // Try exact match first, then with .bsky.social suffix
        const authorHandle = allHandles[originalPostAuthor] || 
                              allHandles[`${originalPostAuthor}.bsky.social`] || 
                              `@${originalPostAuthor}`;
        finalResponse = `${authorHandle} ${finalResponse}`;
    } else if (strategy === 'loop-in' && originalPostAuthor && botToLoopIn) {
        const authorHandle = allHandles[originalPostAuthor] || 
                              allHandles[`${originalPostAuthor}.bsky.social`] || 
                              `@${originalPostAuthor}`;
        const botHandle = allHandles[botToLoopIn] || 
                           allHandles[`${botToLoopIn}.bsky.social`] || 
                           `@${botToLoopIn}`;
        finalResponse = `${authorHandle} ${botHandle} ${finalResponse}`;
    }

    // Ensure character limit (295 chars max for replies with tags)
    if (finalResponse.length > 295) {
        // Extract tags and preserve them (updated regex for longer handles)
        const tags = finalResponse.match(/@[\w.-]+/g) || [];
        const tagText = tags.join(' ');
        const contentWithoutTags = finalResponse.replace(/@[\w.-]+/g, '').trim();
        
        // Calculate available characters (295 - tag length - 1 for space)
        const maxContentLength = 295 - tagText.length - 1;
        
        if (contentWithoutTags.length > maxContentLength) {
            finalResponse = `${tagText} ${contentWithoutTags.substring(0, maxContentLength - 3)}...`;
        } else {
            finalResponse = `${tagText} ${contentWithoutTags}`;
        }
    }

    console.log(`🚀 Multi-layer AI response generated for ${personaKey}: "${finalResponse}"`);
    console.log(`📊 Engagement prediction: ${viralResponse.engagement_prediction}, Controversy: ${viralResponse.controversy_level}`);

    return finalResponse;
}
