import fs from "node:fs";
import path from "node:path";

const STATE_PATH = path.resolve(process.cwd(), "data", "state.json");

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function loadState() {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const state = JSON.parse(raw);
    
    // Ensure proper state structure
    if (!state.bots) state.bots = {};
    if (!state.seenNotifications) state.seenNotifications = {};
    if (!state.performance) state.performance = {};
    
    console.log(`📋 State loaded successfully`);
    return state;
  } catch {
    // Return default state structure
    const defaultState = { 
      version: 1, 
      lastRunUtc: null, 
      bots: {}, 
      seenNotifications: {},
      performance: {}
    };
    // Save default state to create the file
    ensureDataDir();
    try {
      fs.writeFileSync(STATE_PATH, JSON.stringify(defaultState, null, 2), "utf8");
    } catch (e) {
      // If we can't write, just return the default
      console.warn("Could not create state file:", e?.message);
    }
    return defaultState;
  }
}

export function saveState(state) {
  try {
    ensureDataDir();
    state.lastRunUtc = new Date().toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save state:", e?.message);
  }
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
  
  // Also track as replied for the new system
  if (!state.bots) state.bots = {};
  if (!state.bots[personaKey]) state.bots[personaKey] = {};
  if (!state.bots[personaKey].repliedTo) state.bots[personaKey].repliedTo = [];
  
  const repliedArr = state.bots[personaKey].repliedTo;
  if (!repliedArr.includes(notifUri)) {
    repliedArr.unshift(notifUri);
    state.bots[personaKey].repliedTo = repliedArr.slice(0, maxSeen);
  }
}
