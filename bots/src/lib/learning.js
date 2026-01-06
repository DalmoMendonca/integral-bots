import { loadState, saveState } from './state.js';
import { PERSONAS, BOT_ORDER } from './personas.js';

/**
 * Simplified performance tracking for bots
 */
export class PerformanceTracker {
  constructor() {
    this.state = null;
  }

  /**
   * Track post performance metrics
   */
  trackPostPerformance(personaKey, postUri, metrics) {
    this.state = loadState();
    
    if (!this.state.performance) this.state.performance = {};
    if (!this.state.performance[personaKey]) {
      this.state.performance[personaKey] = {
        posts: [],
        totalPosts: 0,
        avgLikes: 0,
        avgShares: 0,
        avgReplies: 0
      };
    }

    const perf = this.state.performance[personaKey];
    
    const postRecord = {
      uri: postUri,
      timestamp: Date.now(),
      metrics: {
        likes: metrics.likes || 0,
        shares: metrics.shares || 0,
        replies: metrics.replies || 0,
        totalEngagement: (metrics.likes || 0) + (metrics.shares || 0) + (metrics.replies || 0)
      },
      tone: metrics.tone,
      content: metrics.content,
      wasReply: metrics.wasReply || false
    };

    perf.posts.push(postRecord);
    perf.totalPosts++;

    // Update averages
    this.updateAverages(personaKey);
    
    saveState(this.state);
  }

  updateAverages(personaKey) {
    const perf = this.state.performance[personaKey];
    const posts = perf.posts;
    
    if (posts.length === 0) return;

    const totalLikes = posts.reduce((sum, p) => sum + p.metrics.likes, 0);
    const totalShares = posts.reduce((sum, p) => sum + p.metrics.shares, 0);
    const totalReplies = posts.reduce((sum, p) => sum + p.metrics.replies, 0);

    perf.avgLikes = totalLikes / posts.length;
    perf.avgShares = totalShares / posts.length;
    perf.avgReplies = totalReplies / posts.length;
  }
}

export const performanceTracker = new PerformanceTracker();
