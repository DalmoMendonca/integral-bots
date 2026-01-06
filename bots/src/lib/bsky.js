import { BskyAgent, RichText } from "@atproto/api";

async function asRichText(agent, text) {
  // Bluesky needs facets for clickable links + real mentions.
  // detectFacets(...) resolves @handles to DIDs and annotates URLs.
  const rt = new RichText({ text });
  await rt.detectFacets(agent);
  return rt;
}

export async function loginAgent({ handle, appPassword }) {
  const agent = new BskyAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password: appPassword });
  return agent;
}

export async function createPost(agent, text) {
  const rt = await asRichText(agent, text);
  return agent.post({
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  });
}

export async function replyToUri(agent, parentUri, text) {
  const thread = await agent.getPostThread({ uri: parentUri, depth: 0 });
  const post = thread?.data?.thread?.post;
  if (!post?.uri || !post?.cid) throw new Error("Could not resolve parent post for reply");
  const root = thread?.data?.thread?.post?.reply?.root ?? { uri: post.uri, cid: post.cid };

  const rt = await asRichText(agent, text);

  return agent.post({
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
    reply: {
      root: { uri: root.uri, cid: root.cid },
      parent: { uri: post.uri, cid: post.cid },
    },
  });
}

export async function listMentions(agent, limit = 25) {
  // Notifications are the simplest "opt-in" gate: only respond when tagged.
  const res = await agent.listNotifications({ limit });
  const notifs = res?.data?.notifications ?? [];
  return notifs.filter(n => (n.reason === "mention" || n.reason === "reply") && n.uri);
}
