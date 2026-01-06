import fs from "node:fs";
import path from "node:path";

const STATE_PATH = path.resolve(process.cwd(), "data", "state.json");

export function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: 1, lastRunUtc: null, bots: {}, seenNotifications: {} };
  }
}

export function saveState(state) {
  state.lastRunUtc = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function wasNotificationSeen(state, personaKey, notifUri) {
  const seen = state.seenNotifications?.[personaKey] ?? [];
  return seen.includes(notifUri);
}

export function markNotificationSeen(state, personaKey, notifUri, maxSeen = 250) {
  if (!state.seenNotifications) state.seenNotifications = {};
  const arr = state.seenNotifications[personaKey] ?? [];
  arr.unshift(notifUri);
  state.seenNotifications[personaKey] = Array.from(new Set(arr)).slice(0, maxSeen);
}
