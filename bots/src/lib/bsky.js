import { BskyAgent, RichText } from "@atproto/api";
import { performanceTracker } from "./learning.js";

async function asRichText(agent, text) {
  // Bluesky needs facets for clickable links + real mentions.
  // detectFacets(...) resolves @handles to DIDs and annotates URLs.
  const rt = new RichText({ text });
  await rt.detectFacets(agent);
  
  // Enhanced link embedding for better previews
  const facets = rt.facets || [];
  
  // Process each facet to ensure proper embedding
  for (let i = 0; i < facets.length; i++) {
    const facet = facets[i];
    
    // If this is a URL facet, ensure it's properly formatted for embedding
    if (facet.features?.[0]?.['$type'] === 'app.bsky.richtext.facet#link') {
      const uri = facet.features[0].uri;
      
      // Validate and clean the URI
      try {
        const url = new URL(uri);
        // Ensure proper URL format for Bluesky embedding
        facet.features[0].uri = url.toString();
      } catch (e) {
        console.warn(`Invalid URL in facet: ${uri}`, e);
      }
    }
  }
  
  rt.facets = facets;
  return rt;
}

export async function loginAgent({ handle, appPassword }) {
  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password: appPassword });
  return agent;
}

export async function createPost(agent, text, personaKey, tone, topic) {
  const rt = await asRichText(agent, text);
  
  // Extract URLs from text for potential embedding
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const urls = text.match(urlRegex) || [];
  
  const postOptions = {
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };
  
  // Try to create embed for first URL if found
  if (urls.length > 0) {
    try {
      const url = urls[0];
      // For Bluesky, we need to resolve the external URL to create an embed
      const response = await fetch(url, { method: 'HEAD' });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        
        // Create embed based on content type
        if (contentType.includes('text/html')) {
          // External link embed
          postOptions.embed = {
            $type: 'app.bsky.embed.external',
            external: {
              uri: url,
              title: extractTitleFromUrl(url),
              description: extractDescriptionFromUrl(url),
            }
          };
        } else if (contentType.startsWith('image/')) {
          // Image embed
          postOptions.embed = {
            $type: 'app.bsky.embed.images',
            images: [{
              alt: 'Embedded image',
              image: {
                $type: 'blob',
                ref: {
                  $link: url
                }
              }
            }]
          };
        }
      }
    } catch (e) {
      console.warn(`Could not create embed for URL ${urls[0]}:`, e.message);
      // Continue without embed if it fails
    }
  }

  const result = await agent.post(postOptions);

  // Track post creation for learning
  performanceTracker.trackPostPerformance(personaKey, result.uri, {
    tone: tone,
    content: text,
    topic: topic,
    wasReply: false,
    likes: 0, // Will be updated later
    shares: 0,
    replies: 0
  });

  return result;
}

// Helper functions for embed metadata
function extractTitleFromUrl(url) {
  // Simple fallback - in production, you might want to fetch and parse HTML
  const domain = new URL(url).hostname;
  return `Link from ${domain}`;
}

function extractDescriptionFromUrl(url) {
  // Simple fallback
  return `Check out this link: ${url}`;
}

export async function replyToUri(agent, parentUri, text, personaKey, tone) {
  const thread = await agent.getPostThread({ uri: parentUri, depth: 0 });
  const post = thread?.data?.thread?.post;
  if (!post?.uri || !post?.cid) throw new Error("Could not resolve parent post for reply");
  const root = thread?.data?.thread?.post?.reply?.root ?? { uri: post.uri, cid: post.cid };

  const rt = await asRichText(agent, text);

  const result = await agent.post({
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
    reply: {
      root: { uri: root.uri, cid: root.cid },
      parent: { uri: post.uri, cid: post.cid },
    },
  });

  // Track reply for learning
  performanceTracker.trackPostPerformance(personaKey, result.uri, {
    tone: tone,
    content: text,
    wasReply: true,
    mentions: extractMentions(text),
    likes: 0, // Will be updated later
    shares: 0,
    replies: 0
  });

  return result;
}

export async function listMentions(agent, limit = 25) {
  // Notifications are the simplest "opt-in" gate: only respond when tagged.
  const res = await agent.listNotifications({ limit });
  const notifs = res?.data?.notifications ?? [];
  return notifs.filter(n => (n.reason === "mention" || n.reason === "reply") && n.uri);
}

export async function updatePostMetrics(agent, personaKey) {
  try {
    const perf = performanceTracker.state?.performance?.[personaKey];
    if (!perf) return;

    // Update metrics for recent posts (last 50)
    const recentPosts = perf.posts.slice(0, 50);
    
    for (const postRecord of recentPosts) {
      try {
        const postThread = await agent.getPostThread({ uri: postRecord.uri, depth: 0 });
        const post = postThread?.data?.thread?.post;
        
        if (post) {
          const likeCount = post.likeCount || 0;
          const repostCount = post.repostCount || 0;
          const replyCount = post.replyCount || 0;
          
          // Update metrics if changed
          if (postRecord.metrics.likes !== likeCount || 
              postRecord.metrics.shares !== repostCount || 
              postRecord.metrics.replies !== replyCount) {
            
            postRecord.metrics.likes = likeCount;
            postRecord.metrics.shares = repostCount;
            postRecord.metrics.replies = replyCount;
            postRecord.metrics.totalEngagement = likeCount + repostCount + replyCount;
            
            // Re-save state with updated metrics
            performanceTracker.updateAverages(personaKey);
          }
        }
      } catch (e) {
        // Post might be deleted or inaccessible
        console.warn(`Could not update metrics for ${postRecord.uri}:`, e?.message);
      }
    }
  } catch (e) {
    console.warn(`Error updating post metrics for ${personaKey}:`, e?.message);
  }
}

export function extractMentions(text) {
  const mentions = [];
  const mentionRegex = /@([a-zA-Z0-9.-]+)/g;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

export async function getUnansweredMentions(agent, personaKey, state, hoursBack = 24) {
  const notifs = await listMentions(agent, 100); // Get more notifications to catch all mentions
  const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
  
  const unanswered = [];
  
  for (const notif of notifs) {
    // Skip if too old
    if (notif.indexedAt && new Date(notif.indexedAt).getTime() < cutoffTime) {
      continue;
    }
    
    // Skip if already replied to (more comprehensive check)
    const wasReplied = state?.bots?.[personaKey]?.repliedTo?.includes(notif.uri) ||
                       state?.seenNotifications?.[personaKey]?.includes(notif.uri);
    if (wasReplied) {
      continue;
    }
    
    // Check if this is a bot-to-bot interaction
    const isFromBot = notif.author?.handle && 
                     Object.values(state?.bots || {}).some(bot => 
                       bot.handle === notif.author.handle);
    
    unanswered.push({
      ...notif,
      isFromBot,
      priority: isFromBot ? 2 : 1 // Prioritize bot-to-bot interactions
    });
  }
  
  // Sort by priority (bot interactions first) and recency
  return unanswered.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return new Date(b.indexedAt) - new Date(a.indexedAt);
  });
}
