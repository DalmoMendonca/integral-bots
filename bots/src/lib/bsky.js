import { BskyAgent, RichText } from "@atproto/api";
import { performanceTracker } from "./learning.js";

async function asRichText(agent, text) {
  // CRITICAL DEBUG: Log input text before processing
  console.log(`🔍 INPUT TEXT:`, text);
  console.log(`🔍 EXTRACTED URLS:`, text.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g));

  // Bluesky needs facets for clickable links + real mentions.
  // detectFacets(...) resolves @handles to DIDs and annotates URLs.
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  // Enhanced link embedding for better previews
  const facets = rt.facets || [];

  // CRITICAL DEBUG: Log facets after processing
  console.log(`🔍 PROCESSED FACETS:`, JSON.stringify(facets, null, 2));
  
  // Process each facet to ensure proper embedding
  for (let i = 0; i < facets.length; i++) {
    const facet = facets[i];
    
    // If this is a URL facet, ensure it's properly formatted for embedding
    if (facet.features?.[0]?.['$type'] === 'app.bsky.richtext.facet#link') {
      const uri = facet.features[0].uri;
      
      // Validate and clean up URI
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
  
  console.log(`🔗 URL EXTRACTION: Found ${urls.length} URLs in text:`, urls);
  
  const postOptions = {
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };
  
  // Try to create embed for first URL if found
  if (urls.length > 0) {
    console.log(`🔗 EMBED ATTEMPT: Creating embed for URL: ${urls[0]}`);
    try {
      const url = urls[0];
      console.log(`Creating embed for URL: ${url}`);
      
      // Extract rich metadata using Jina AI
      const metadata = await extractUrlMetadata(url);
      
      // Create rich external embed
      const embedData = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: url,
          title: metadata.title,
          description: metadata.description,
        }
      };
      
      // Add thumbnail if we found one AND it's a valid URL
      if (metadata.thumbnail && metadata.thumbnail.startsWith('http')) {
        embedData.external.thumb = {
          $type: 'blob',
          ref: {
            $link: metadata.thumbnail
          },
          mimeType: 'image/jpeg',
          size: 0 // Bluesky will figure this out
        };
      }
      
      postOptions.embed = embedData;
      
      console.log(`✅ EMBED SUCCESS: Created embed with title: "${metadata.title}", thumbnail: ${metadata.thumbnail ? 'YES' : 'NO'}`);
      console.log(`🔗 EMBED DATA:`, JSON.stringify(embedData, null, 2));
    } catch (e) {
      console.warn(`❌ EMBED FAILED: Could not create embed for URL ${urls[0]}:`, e.message);
      console.warn(`🔗 ERROR STACK:`, e.stack);
      // Continue without embed if it fails
    }
  } else {
    console.log(`🔗 NO EMBED: No URLs found in text to embed`);
  }

  const result = await agent.post(postOptions);
  
  // CRITICAL DEBUGGING: Log exact post creation details
  console.log(`🔍 POST OPTIONS:`, JSON.stringify(postOptions, null, 2));
  console.log(`🔍 RESULT:`, JSON.stringify(result, null, 2));
  console.log(`🔍 EMBED SUCCESS:`, !!postOptions.embed);
  
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
  
  console.log(`✅ Post created for ${personaKey}: ${result.uri}`);
  console.log(`📝 Post content: ${text.slice(0, 100)}...`);
  console.log(`🔗 Embed: ${postOptions.embed ? 'YES' : 'NO'}`);
  
  return result;
}

// Helper functions for embed metadata
async function extractUrlMetadata(url) {
  try {
    console.log(`Fetching metadata for: ${url}`);
    
    // Method 1: Try Jina AI (most reliable)
    try {
      // Clean URL for Jina AI - remove query params and ensure proper format
      const cleanUrl = url.split('?')[0];
      // Remove http:// or https:// prefix for Jina AI
      const urlWithoutProtocol = cleanUrl.replace(/^https?:\/\//, '');
      const jinaUrl = `https://r.jina.ai/http://${urlWithoutProtocol}`;
      
      console.log(`🌐 Trying Jina AI with URL: ${jinaUrl}`);
      
      const response = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IntegralBots/1.0)'
        },
        timeout: 15000 // 15 second timeout
      });
      
      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');
        
        // Extract title and description from Jina AI summary
        let title = '';
        let description = '';
        
        for (const line of lines) {
          if (line.startsWith('Title:')) {
            title = line.replace('Title:', '').trim();
          } else if (line.startsWith('Summary:')) {
            description = line.replace('Summary:', '').trim();
          }
        }
        
        if (title) {
          console.log(`✅ Jina AI success - Title: "${title}"`);
          
          // Method 2: Try to fetch the actual HTML to get thumbnail image
          let thumbnail = '';
          try {
            const htmlResponse = await fetch(cleanUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; IntegralBots/1.0)'
              },
              timeout: 10000
            });
            
            if (htmlResponse.ok) {
              const html = await htmlResponse.text();
              
              // Extract Open Graph image
              const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
              if (ogImageMatch && ogImageMatch[1]) {
                thumbnail = ogImageMatch[1];
                console.log(`🖼️ Found OG image: ${thumbnail}`);
              }
              
              // Extract Twitter image as fallback
              if (!thumbnail) {
                const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
                if (twitterImageMatch && twitterImageMatch[1]) {
                  thumbnail = twitterImageMatch[1];
                  console.log(`🖼️ Found Twitter image: ${thumbnail}`);
                }
              }
              
              // Extract better description from meta tags if Jina AI didn't get one
              if (!description) {
                const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
                if (ogDescMatch && ogDescMatch[1]) {
                  description = ogDescMatch[1];
                  console.log(`📝 Found OG description: ${description.substring(0, 50)}...`);
                }
              }
            }
          } catch (htmlError) {
            console.warn(`⚠️ Could not fetch HTML for thumbnail: ${htmlError.message}`);
          }
          
          return {
            title: title,
            description: description || `Content from ${new URL(url).hostname}`,
            thumbnail: thumbnail
          };
        }
      } else {
        throw new Error(`Jina AI returned ${response.status}`);
      }
    } catch (jinaError) {
      console.warn(`❌ Jina AI failed: ${jinaError.message}`);
    }
    
    // Fallback if no title found
    if (!title) {
      const urlObj = new URL(url);
      title = urlObj.hostname.replace('www.', '');
    }
    
    // Clean up description - make it more natural
    if (description && description.length > 200) {
      description = description.substring(0, 197) + '...';
    }
    
    console.log(`Extracted - Title: "${title}", Description: "${description?.substring(0, 50) || 'none'}...", Thumbnail: "${thumbnail || 'none'}"`);
    
    return {
      title: title || `Link from ${new URL(url).hostname}`,
      description: description || `Check out this content from ${new URL(url).hostname}`,
      thumbnail: thumbnail
    };
    
  } catch (error) {
    console.warn(`Metadata extraction failed for ${url}:`, error.message);
    return {
      title: `Link from ${new URL(url).hostname}`,
      description: `Check out this link: ${url}`,
      thumbnail: ''
    };
  }
}

function extractTitleFromUrl(url) {
  return `Link from ${new URL(url).hostname}`;
}

function extractDescriptionFromUrl(url) {
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
  console.log(`🔔 Fetching notifications with limit: ${limit}`);
  
  const res = await agent.listNotifications({ limit });
  const notifs = res?.data?.notifications ?? [];
  
  console.log(`📊 Total notifications retrieved: ${notifs.length}`);
  
  // Debug: Log all notifications to understand structure
  notifs.forEach((notif, i) => {
    console.log(`🔍 Notification ${i}: reason="${notif.reason}", uri="${notif.uri}", author="${notif.author?.handle}"`);
  });
  
  const mentions = notifs.filter(n => (n.reason === "mention" || n.reason === "reply") && n.uri);
  
  console.log(`📝 Filtered to ${mentions.length} mentions/replies`);
  
  return mentions;
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
  
  console.log(`🕐 Filtering mentions from last ${hoursBack} hours (cutoff: ${new Date(cutoffTime).toISOString()})`);
  
  const unanswered = [];
  
  for (const notif of notifs) {
    console.log(`🔍 Processing notification: ${notif.uri} | reason: ${notif.reason} | author: ${notif.author?.handle}`);
    
    // Skip if too old
    if (notif.indexedAt && new Date(notif.indexedAt).getTime() < cutoffTime) {
      console.log(`⏰ Skipping old notification: ${notif.uri} (${notif.indexedAt})`);
      continue;
    }
    
    // Skip if already replied to (more comprehensive check)
    const wasReplied = state?.bots?.[personaKey]?.repliedTo?.includes(notif.uri) ||
                       state?.seenNotifications?.[personaKey]?.includes(notif.uri);
    
    console.log(`📋 Reply check for ${notif.uri}: wasReplied=${wasReplied}`);
    console.log(`📋 State check: repliedTo=${state?.bots?.[personaKey]?.repliedTo?.length || 0} items`);
    console.log(`📋 State check: seenNotifications=${state?.seenNotifications?.[personaKey]?.length || 0} items`);
    
    if (wasReplied) {
      console.log(`⏭ Already replied to: ${notif.uri}`);
      continue;
    }
    
    // Check if this is a bot-to-bot interaction
    const isFromBot = notif.author?.handle && 
                     Object.values(state?.bots || {}).some(bot => 
                       bot.handle === notif.author.handle);
    
    console.log(`🤖 Bot check: ${notif.author?.handle} isFromBot=${isFromBot}`);
    
    // CRITICAL: Fetch the actual post content to get the text for AI response
    let postText = notif.reason; // Fallback
    try {
      if (notif.uri) {
        console.log(`🔍 FETCHING POST: Attempting to get content for ${notif.uri}`);
        const thread = await agent.getPostThread({ uri: notif.uri, depth: 0 });
        postText = thread?.data?.thread?.post?.record?.text || notif.reason;
        console.log(`🔍 FETCHED POST CONTENT: "${postText?.substring(0, 100)}..."`);
      }
    } catch (e) {
      console.warn(`Could not fetch post content for ${notif.uri}:`, e?.message);
      console.warn(`🔍 ERROR STACK:`, e.stack);
    }
    
    unanswered.push({
      ...notif,
      text: postText, // Add the actual post text
      isFromBot,
      priority: isFromBot ? 2 : 1 // Prioritize bot-to-bot interactions
    });
  }
  
  console.log(`📊 Final unanswered count: ${unanswered.length}`);
  
  // Sort by priority (bot interactions first) and recency
  return unanswered.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return new Date(b.indexedAt) - new Date(a.indexedAt);
  });
}
