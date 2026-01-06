import { PERSONAS, BOT_ORDER } from "./personas.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performanceTracker } from "./learning.js";

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
 * Get adaptive tone selection based on learning data
 */
export function getAdaptiveTone(personaKey) {
    const recommendations = performanceTracker.getAdaptiveRecommendations(personaKey);
    
    // If we have learning data, use it
    if (recommendations && recommendations.preferredTones && recommendations.preferredTones.length > 0) {
        // Weight selection toward preferred tones
        const preferredWeights = recommendations.preferredTones.map(t => ({
            tone: t.tone,
            weight: Math.min(t.effectiveness, 2.0) // Cap weight at 2.0
        }));
        
        // Avoid least effective tones (with null check)
        const avoidedTones = new Set(
            (recommendations.avoidedTones || []).map(t => t.tone)
        );
        
        const availableTones = TONES.filter(tone => {
            const toneName = tone.split(' - ')[0];
            return !avoidedTones.has(toneName);
        });
        
        if (availableTones.length > 0) {
            return pick(availableTones);
        }
    }
    
    // Fallback to random selection
    return pick(TONES);
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
            RUTH: ["How does this call us to prayer?", "Your pastoral thoughts?"]
        },
        RAYMOND: {
            KENNY: ["What's the developmental angle here?", "AQAL perspective?"],
            BRYCE: ["What data would change your mind?", "Mechanism analysis?"]
        },
        PARKER: {
            ANDREA: ["How do we protect the vulnerable here?", "Whose voices are missing?"],
            KENNY: ["What about power dynamics?", "How does this affect the marginalized?"]
        },
        KENNY: {
            RAYMOND: ["Altitude check on this?", "What's the integral view?"],
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
    
    // Use adaptive tone selection
    const tone = getAdaptiveTone(personaKey);
    
    // Enhanced conversation starter
    const conversation = maybeStartConversation(personaKey, allHandles, topic);

    // Calculate exact budget: 300 max - URL length - newline - safety margin
    const urlLength = url ? url.length + 1 : 0; // +1 for newline
    const conversationLength = conversation ? conversation.length + 1 : 0;
    const textBudget = 300 - urlLength - conversationLength - 5; // 5 char safety margin

    // Get learning recommendations
    const recommendations = performanceTracker.getAdaptiveRecommendations(personaKey);
    const learningContext = generateLearningContext(recommendations);

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
        `## LEARNING GUIDANCE`,
        learningContext,
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
        conversation ? `CONVERSATION STARTER (include exactly as shown): ${conversation}` : `(no conversation)`,
        "",
        `## OUTPUT FORMAT`,
        `Just the post text. If there's a URL, put it on its own line at the end.`,
        `If there's a conversation starter, include it naturally in your text.`,
        `ENSURE EVERY SENTENCE IS COMPLETE AND PROPERLY ENDED.`,
    ].join("\n");

    console.log(`[${personaKey}] Calling OpenAI with adaptive tone: ${tone}`);

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
 * Compose a reply using OpenAI's Responses API with AI-driven conversation flow.
 */
export async function composeReply({ personaKey, promptText, config, isFromBot, priority, originalPostAuthor, originalPostUri, replyCount = 0, conversationDepth = 1, allHandles = {} }) {
    if (!config.openaiApiKey) {
        throw new Error(`OPENAI_API_KEY is not set. Cannot generate reply for ${personaKey}.`);
    }

    const mod = await import("openai");
    const OpenAI = mod.OpenAI || mod.default?.OpenAI || mod.default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const personaPrompt = getPersonaPrompt(personaKey);
    const tone = pick(TONES);

    // Enhanced context: try to get original post content
    let enhancedContext = promptText ?? "(no context provided)";
    
    // If we have the original post URI, try to fetch its content for better context
    if (originalPostUri && originalPostUri.includes('app.bsky.feed.post')) {
        try {
            // Extract DID and post ID from URI
            const match = originalPostUri.match(/at:\/\/did:([^\/]+)\/app\.bsky\.feed\.post\/([^]+)/);
            if (match) {
                const [, did, postId] = match;
                
                // Try to get the original post content
                const postResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPost?uri=${encodeURIComponent(originalPostUri)}`);
                if (postResponse.ok) {
                    const postData = await postResponse.json();
                    if (postData.thread?.post?.record?.text) {
                        enhancedContext = postData.thread.post.record.text;
                        console.log(`📖 Fetched original post content: "${enhancedContext.substring(0, 100)}..."`);
                    }
                }
            }
        } catch (fetchError) {
            console.warn(`⚠️ Could not fetch original post: ${fetchError.message}`);
        }
    }

    // Let AI decide conversation strategy
    const strategy = await determineConversationStrategyWithAI({
        personaKey,
        isFromBot,
        priority,
        replyCount,
        conversationDepth,
        hasOpenQuestions: enhancedContext.includes('?'),
        topicComplexity: 'medium', // AI will figure this out from content
        originalPostContent: enhancedContext,
        allHandles
    });

    // Let AI select bot to loop in if needed
    let botToLoopIn = null;
    if (strategy === 'loop-in') {
        botToLoopIn = await selectBotToLoopInWithAI({
            personaKey,
            originalPostContent: enhancedContext,
            allHandles
        });
    }

    // Build tagging instructions based on AI decision
    let taggingInstructions = '';
    if (strategy === 'continue') {
        taggingInstructions = `TAG @${originalPostAuthor || 'original_poster'} to continue the conversation.`;
    } else if (strategy === 'loop-in' && botToLoopIn) {
        taggingInstructions = `TAG both @${originalPostAuthor || 'original_poster'} and @${botToLoopIn} to bring in fresh perspective.`;
    } else {
        taggingInstructions = `DO NOT TAG anyone - let this be a natural conversation end point.`;
    }

    const input = [
        personaPrompt,
        "",
        "## YOUR TASK",
        `Write a SHORT, COMPLETE reply (under 280 characters) to someone who tagged you.`,
        "CRITICAL REQUIREMENTS:",
        "1. READ AND UNDERSTAND the original post content - don't just respond generically",
        "2. Add YOUR UNIQUE PERSPECTIVE as this persona - what insights can only you offer?",
        "3. ADVANCE THE CONVERSATION - ask questions, offer insights, or connect to bigger ideas",
        "4. FOLLOW TAGGING INSTRUCTIONS EXACTLY as specified below",
        "5. Every sentence MUST be complete. NO trailing off with '...' or incomplete thoughts",
        "6. DO NOT end with conjunctions like 'and', 'but', 'because' without finishing thought",
        "",
        `## CONTEXT FROM THE USER'S POST`,
        enhancedContext,
        "",
        `## CONVERSATION CONTEXT`,
        `- This is a ${isFromBot ? 'bot-to-bot' : 'human-to-bot'} interaction`,
        `- Priority level: ${priority}`,
        `- Original poster: @${originalPostAuthor || 'unknown'}`,
        `- Reply count in thread: ${replyCount}`,
        `- Conversation depth: ${conversationDepth}`,
        `- Topic complexity: ${topicComplexity}`,
        `- Has open questions: ${hasOpenQuestions}`,
        "",
        `## TONE FOR THIS REPLY`,
        `Approach: ${tone}`,
        "",
        "## CONVERSATION STRATEGY",
        `Strategy: ${strategy}`,
        taggingInstructions,
        "",
        "## REPLY REQUIREMENTS",
        "- Add unique insights from your persona's perspective",
        "- Ask thoughtful questions or make connections",
        "- Keep it conversational and engaging",
        "- ENSURE EVERY SENTENCE IS COMPLETE AND PROPERLY ENDED",
        "",
        "Just output the reply text, nothing else.",
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
