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

function decodeHtmlEntities(value) {
  if (!value) return value;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function guessImageMimeType(url) {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

function normalizeUrlCandidate(candidate, baseUrl) {
  if (!candidate) return "";
  let cleaned = decodeHtmlEntities(candidate).trim();
  if (!cleaned) return "";

  if (cleaned.startsWith("data:")) {
    return cleaned;
  }

  try {
    return new URL(cleaned, baseUrl).toString();
  } catch (error) {
    return cleaned;
  }

}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Unsupported data URL format");
  }

  const mimeType = match[1];
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Unsupported data URL type: ${mimeType}`);
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType: mimeType
  };
}

async function fetchImageBuffer(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; IntegralBots/1.0)",
      "Referer": url,
      "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
      "Accept-Encoding": "identity"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Thumbnail fetch failed with status ${response.status}`);
  }

  const contentTypeHeader = response.headers.get("content-type") || "";
  const contentType = contentTypeHeader.split(";")[0].trim().toLowerCase();
  const mimeType = contentType || guessImageMimeType(url);
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Thumbnail content-type is not an image: ${contentTypeHeader}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) {
    throw new Error("Thumbnail response was empty");
  }

  return { buffer, mimeType, size: buffer.length };
}

export async function createPost(agent, text, personaKey, tone, topic) {
  const rt = await asRichText(agent, text);
  
  // CRITICAL: Use topic URL directly for embed, don't look for it in text
  const topicUrl = topic?.link;
  console.log(`🔗 EMBED CHECK: Topic URL available: ${topicUrl ? 'YES' : 'NO'}`, topicUrl || '');
  
  const postOptions = {
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };
  
  // Create embed directly from topic URL if available
  if (topicUrl) {
    console.log(`🔗 EMBED ATTEMPT: Creating embed for topic URL: ${topicUrl}`);
    try {
      console.log(`Creating embed for URL: ${topicUrl}`);
      
      // Extract rich metadata using Jina AI
      const metadata = await extractUrlMetadata(topicUrl);
      
      // Create rich external embed with thumbnail support
      const embedData = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: topicUrl,
          title: metadata.title,
          description: metadata.description,
        }
      };
      
      // Add thumbnail if available
      if (metadata.thumbnail) {
        try {
          const thumbnailUrl = normalizeUrlCandidate(metadata.thumbnail, topicUrl);
          if (!thumbnailUrl) {
            throw new Error("Thumbnail URL missing after normalization");
          }

          console.log(`Uploading thumbnail: ${thumbnailUrl}`);

          let imageBuffer;
          let mimeType;
          if (thumbnailUrl.startsWith("data:")) {
            const parsed = parseDataUrl(thumbnailUrl);
            imageBuffer = parsed.buffer;
            mimeType = parsed.mimeType;
          } else {
            const fetched = await fetchImageBuffer(thumbnailUrl);
            imageBuffer = fetched.buffer;
            mimeType = fetched.mimeType;
          }

          const thumbnailBlob = await agent.uploadBlob(imageBuffer, {
            encoding: mimeType
          });

          const blobData = thumbnailBlob?.data?.blob || thumbnailBlob?.blob || thumbnailBlob;
          if (!blobData || !blobData.ref) {
            throw new Error("Could not find blob data in upload response");
          }

          embedData.external.thumb = blobData;
          console.log("Thumbnail uploaded successfully");
        } catch (thumbError) {
          console.warn(`Thumbnail upload failed: ${thumbError.message}`);
          // Continue without thumbnail
        }
      }

      postOptions.embed = embedData;
      console.log(`✅ EMBED SUCCESS: Created embed with title: "${metadata.title}", thumbnail: ${embedData.external.thumb ? 'YES' : 'NO'}`);
      console.log(`🔗 EMBED DATA:`, JSON.stringify(embedData, null, 2));
    } catch (e) {
      console.warn(`❌ EMBED FAILED: Could not create embed for topic URL ${topicUrl}:`, e.message);
      console.warn(`🔗 ERROR STACK:`, e.stack);
      // Continue without embed if it fails
    }
  } else {
    console.log(`🔗 NO EMBED: No topic URL available to embed`);
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
    
    let title = '';
    let description = '';
    let thumbnail = '';
    
    // Strategy 1: Try Jina AI (most reliable for content extraction)
    try {
      // Clean URL for Jina AI - remove query params and ensure proper format
      const cleanUrl = url.split('?')[0];
      // Remove http:// or https:// prefix for Jina AI
      const urlWithoutProtocol = cleanUrl.replace(/^https?:\/\//, '');
      const jinaUrl = `https://r.jina.ai/http://${urlWithoutProtocol}`;
      
      console.log(`🌐 Strategy 1: Trying Jina AI with URL: ${jinaUrl}`);
      
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
        for (const line of lines) {
          if (line.startsWith('Title:')) {
            title = line.replace('Title:', '').trim();
          } else if (line.startsWith('Summary:')) {
            description = line.replace('Summary:', '').trim();
          }
        }
        
        if (title) {
          console.log(`✅ Jina AI success - Title: "${title}"`);
        }
      } else {
        console.warn(`⚠️ Jina AI returned ${response.status}`);
      }
    } catch (jinaError) {
      console.warn(`⚠️ Jina AI failed: ${jinaError.message}`);
    }
    
    // Strategy 2: Direct HTML parsing with multiple fallbacks
    if (!title || title.length < 3 || !description || !thumbnail) {
      try {
        console.log(`🌐 Strategy 2: Trying direct HTML parsing`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 10000
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Extract title with multiple methods
          if (!title) {
            // Method 2a: Open Graph title
            const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
            if (ogTitleMatch && ogTitleMatch[1]) {
              title = decodeHtmlEntities(ogTitleMatch[1]);
              console.log(`📝 Found OG title: ${title}`);
            }
          }
          
          if (!title) {
            // Method 2b: Twitter title
            const twitterTitleMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
            if (twitterTitleMatch && twitterTitleMatch[1]) {
              title = decodeHtmlEntities(twitterTitleMatch[1]);
              console.log(`📝 Found Twitter title: ${title}`);
            }
          }
          
          if (!title) {
            // Method 2c: HTML title tag
            const htmlTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (htmlTitleMatch && htmlTitleMatch[1]) {
              title = decodeHtmlEntities(htmlTitleMatch[1].trim());
              console.log(`📝 Found HTML title: ${title}`);
            }
          }
          
          // Extract description with multiple methods
          if (!description) {
            // Method 2a: Open Graph description
            const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
            if (ogDescMatch && ogDescMatch[1]) {
              description = decodeHtmlEntities(ogDescMatch[1]);
              console.log(`📝 Found OG description: ${description.substring(0, 50)}...`);
            }
          }
          
          if (!description) {
            // Method 2b: Twitter description
            const twitterDescMatch = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
            if (twitterDescMatch && twitterDescMatch[1]) {
              description = decodeHtmlEntities(twitterDescMatch[1]);
              console.log(`📝 Found Twitter description: ${description.substring(0, 50)}...`);
            }
          }
          
          if (!description) {
            // Method 2c: Meta description
            const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
            if (metaDescMatch && metaDescMatch[1]) {
              description = decodeHtmlEntities(metaDescMatch[1]);
              console.log(`📝 Found meta description: ${description.substring(0, 50)}...`);
            }
          }
          
          // Extract thumbnail with multiple methods
          if (!thumbnail) {
            // Method 2a: Open Graph secure image
            const ogImageSecureMatch = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i);
            if (ogImageSecureMatch && ogImageSecureMatch[1]) {
              thumbnail = ogImageSecureMatch[1];
              console.log(`Found OG secure image: ${thumbnail}`);
            }
          }

          if (!thumbnail) {
            // Method 2b: Open Graph image URL
            const ogImageUrlMatch = html.match(/<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i);
            if (ogImageUrlMatch && ogImageUrlMatch[1]) {
              thumbnail = ogImageUrlMatch[1];
              console.log(`Found OG image URL: ${thumbnail}`);
            }
          }

          if (!thumbnail) {
            // Method 2a: Open Graph image
            const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
            if (ogImageMatch && ogImageMatch[1]) {
              thumbnail = ogImageMatch[1];
              console.log(`🖼️ Found OG image: ${thumbnail}`);
            }
          }
          
          if (!thumbnail) {
            // Method 2b: Twitter image
            const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
            if (twitterImageMatch && twitterImageMatch[1]) {
              thumbnail = twitterImageMatch[1];
              console.log(`🖼️ Found Twitter image: ${thumbnail}`);
            }
          }
          
          // Method 2c: Try to find first image in content as last resort
          if (!thumbnail) {
            const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
            if (imgMatch && imgMatch[1] && !imgMatch[1].includes('data:image')) {
              thumbnail = imgMatch[1];
              console.log(`🖼️ Found first content image: ${thumbnail}`);
            }
          }
        }
      } catch (htmlError) {
        console.warn(`⚠️ HTML parsing failed: ${htmlError.message}`);
      }
    }
    
    // Clean up and validate results
    if (!title || title.length < 3) {
      const urlObj = new URL(url);
      title = urlObj.hostname.replace('www.', '');
      console.log(`📝 Using hostname fallback: ${title}`);
    }
    
    if (title) {
      title = decodeHtmlEntities(title).replace(/\s+/g, " ").trim();
    }

    // Clean up description
    if (description) {
      // Remove extra whitespace and newlines
      description = decodeHtmlEntities(description).replace(/\s+/g, " ").trim();
      
      // Truncate if too long
      if (description.length > 200) {
        description = description.substring(0, 197) + '...';
      }
    }
    
    // Ensure we have some description
    if (!description) {
      description = `Content from ${new URL(url).hostname}`;
    }
    
    // Clean up thumbnail URL
    if (thumbnail) {
      thumbnail = normalizeUrlCandidate(thumbnail, url);
    }
    
    console.log(`✅ Final metadata - Title: "${title}", Description: "${description.substring(0, 50)}...", Thumbnail: ${thumbnail ? 'YES' : 'NO'}`);
    
    return {
      title: title,
      description: description,
      thumbnail: thumbnail
    };
    
  } catch (error) {
    console.warn(`❌ All metadata extraction failed for ${url}:`, error.message);
    return {
      title: `Link from ${new URL(url).hostname}`,
      description: `Check out this content from ${new URL(url).hostname}`,
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

export { extractUrlMetadata };
