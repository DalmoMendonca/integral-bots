import { loadState, saveState } from "./state.js";
import { PERSONAS, BOT_ORDER } from "./personas.js";

/**
 * Performance tracking and learning system for bots
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
        avgReplies: 0,
        bestPerformingTones: {},
        worstPerformingTones: {},
        contentPreferences: {},
        learningData: {
          successfulPatterns: [],
          failedPatterns: [],
          toneEffectiveness: {},
          contentEffectiveness: {},
          interactionSuccess: {}
        }
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
      mentions: metrics.mentions || [],
      wasReply: metrics.wasReply || false
    };

    perf.posts.push(postRecord);
    perf.totalPosts++;

    // Update averages
    this.updateAverages(personaKey);
    
    // Update tone effectiveness
    if (metrics.tone) {
      this.updateToneEffectiveness(personaKey, metrics.tone, postRecord.metrics.totalEngagement);
    }

    // Update content preferences
    this.updateContentPreferences(personaKey, metrics.content, postRecord.metrics.totalEngagement);

    // Track successful/failed patterns
    this.trackPatterns(personaKey, postRecord);

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

  updateToneEffectiveness(personaKey, tone, engagement) {
    const perf = this.state.performance[personaKey];
    
    if (!perf.learningData.toneEffectiveness[tone]) {
      perf.learningData.toneEffectiveness[tone] = {
        uses: 0,
        totalEngagement: 0,
        avgEngagement: 0,
        effectiveness: 0
      };
    }

    const toneData = perf.learningData.toneEffectiveness[tone];
    toneData.uses++;
    toneData.totalEngagement += engagement;
    toneData.avgEngagement = toneData.totalEngagement / toneData.uses;
    
    // Calculate effectiveness relative to persona average
    const avgEngagement = perf.avgLikes + perf.avgShares + perf.avgReplies;
    toneData.effectiveness = toneData.avgEngagement / (avgEngagement || 1);
  }

  updateContentPreferences(personaKey, content, engagement) {
    const perf = this.state.performance[personaKey];
    
    // Extract content keywords
    const keywords = this.extractKeywords(content);
    
    keywords.forEach(keyword => {
      if (!perf.learningData.contentEffectiveness[keyword]) {
        perf.learningData.contentEffectiveness[keyword] = {
          uses: 0,
          totalEngagement: 0,
          avgEngagement: 0,
          effectiveness: 0
        };
      }

      const keywordData = perf.learningData.contentEffectiveness[keyword];
      keywordData.uses++;
      keywordData.totalEngagement += engagement;
      keywordData.avgEngagement = keywordData.totalEngagement / keywordData.uses;
      
      // Calculate effectiveness
      const avgEngagement = perf.avgLikes + perf.avgShares + perf.avgReplies;
      keywordData.effectiveness = keywordData.avgEngagement / (avgEngagement || 1);
    });
  }

  trackPatterns(personaKey, postRecord) {
    const perf = this.state.performance[personaKey];
    const learning = perf.learningData;
    
    // Define success threshold (above average engagement)
    const avgEngagement = perf.avgLikes + perf.avgShares + perf.avgReplies;
    const isSuccessful = postRecord.metrics.totalEngagement > (avgEngagement * 1.2);
    
    // Extract patterns from content
    const patterns = this.extractPatterns(postRecord.content);
    
    patterns.forEach(pattern => {
      if (isSuccessful) {
        if (!learning.successfulPatterns.includes(pattern)) {
          learning.successfulPatterns.push(pattern);
        }
      } else {
        if (!learning.failedPatterns.includes(pattern)) {
          learning.failedPatterns.push(pattern);
        }
      }
    });
  }

  extractKeywords(content) {
    if (!content) return [];
    
    // Simple keyword extraction - in production, use NLP
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Filter out common stop words
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'they', 'have', 'been', 
      'their', 'would', 'there', 'could', 'should', 'will', 'just'
    ]);
    
    return [...new Set(words.filter(word => !stopWords.has(word)))].slice(0, 10);
  }

  extractPatterns(content) {
    if (!content) return [];
    
    const patterns = [];
    
    // Question patterns
    if (content.includes('?')) patterns.push('question');
    
    // Exclamation patterns
    if (content.includes('!')) patterns.push('exclamatory');
    
    // Quote patterns
    if (content.includes('"') || content.includes("'")) patterns.push('quotation');
    
    // Scripture references
    if (/\d+:\d+/.test(content)) patterns.push('scripture_reference');
    
    // Personal pronouns
    if (/\b(I|we|my|our)\b/i.test(content)) patterns.push('personal');
    
    // Call to action
    if (/\b(must|should|let's|join|stand|fight)\b/i.test(content)) patterns.push('call_to_action');
    
    // Theological terms
    if (/\b(grace|faith|sin|salvation|redemption|holy|spirit)\b/i.test(content)) {
      patterns.push('theological');
    }
    
    // Social justice terms
    if (/\b(justice|equity|oppression|liberation|marginalized)\b/i.test(content)) {
      patterns.push('social_justice');
    }
    
    return patterns;
  }

  /**
   * Get adaptive recommendations for a persona
   */
  getAdaptiveRecommendations(personaKey) {
    this.state = loadState();
    
    if (!this.state.performance?.[personaKey]) {
      return this.getDefaultRecommendations(personaKey);
    }

    const perf = this.state.performance[personaKey];
    const learning = perf.learningData;
    
    const recommendations = {
      preferredTones: [],
      avoidedTones: [],
      preferredContent: [],
      effectivePatterns: [],
      ineffectivePatterns: [],
      interactionStrategies: []
    };

    // Tone recommendations
    Object.entries(learning.toneEffectiveness).forEach(([tone, data]) => {
      if (data.effectiveness > 1.2) {
        recommendations.preferredTones.push({ tone, effectiveness: data.effectiveness });
      } else if (data.effectiveness < 0.8) {
        recommendations.avoidedTones.push({ tone, effectiveness: data.effectiveness });
      }
    });

    // Content recommendations
    Object.entries(learning.contentEffectiveness).forEach(([keyword, data]) => {
      if (data.effectiveness > 1.3 && data.uses >= 2) {
        recommendations.preferredContent.push({ keyword, effectiveness: data.effectiveness });
      }
    });

    // Pattern recommendations
    recommendations.effectivePatterns = learning.successfulPatterns.slice(0, 5);
    recommendations.ineffectivePatterns = learning.failedPatterns.slice(0, 5);

    return recommendations;
  }

  getDefaultRecommendations(personaKey) {
    const persona = PERSONAS[personaKey];
    
    const defaults = {
      RUTH: {
        preferredTones: ['gentle adoration', 'joyful celebration', 'pastoral comfort'],
        preferredContent: ['faith', 'prayer', 'miracle', 'healing'],
        effectivePatterns: ['personal', 'theological', 'exclamatory']
      },
      BRYCE: {
        preferredTones: ['hot take', 'righteous conviction', 'prophetic warning'],
        preferredContent: ['justice', 'moral', 'battle', 'courage'],
        effectivePatterns: ['call_to_action', 'exclamatory']
      },
      JERRY: {
        preferredTones: ['philosophical musing', 'pastoral comfort'],
        preferredContent: ['tradition', 'church', 'doctrine', 'wisdom'],
        effectivePatterns: ['theological', 'quotation']
      },
      RAYMOND: {
        preferredTones: ['skeptical inquiry', 'dry wit', 'philosophical musing'],
        preferredContent: ['science', 'evidence', 'analysis', 'research'],
        effectivePatterns: ['question', 'quotation']
      },
      PARKER: {
        preferredTones: ['loving confrontation', 'incarnational solidarity'],
        preferredContent: ['justice', 'equity', 'marginalized', 'community'],
        effectivePatterns: ['social_justice', 'call_to_action']
      },
      KENNY: {
        preferredTones: ['philosophical musing', 'kingdom imagination'],
        preferredContent: ['integral', 'development', 'consciousness', 'framework'],
        effectivePatterns: ['question', 'theological']
      },
      ANDREA: {
        preferredTones: ['mystical awe', 'gentle adoration', 'contemplative'],
        preferredContent: ['presence', 'silence', 'unity', 'contemplative'],
        effectivePatterns: ['theological', 'personal']
      }
    };

    return defaults[personaKey] || {
      preferredTones: ['curious wonder'],
      preferredContent: ['faith', 'spiritual'],
      effectivePatterns: ['personal']
    };
  }

  /**
   * Get performance summary for all bots
   */
  getPerformanceSummary() {
    this.state = loadState();
    
    const summary = {};
    
    BOT_ORDER.forEach(personaKey => {
      const perf = this.state.performance?.[personaKey];
      
      if (perf && perf.posts.length > 0) {
        summary[personaKey] = {
          totalPosts: perf.totalPosts,
          avgEngagement: perf.avgLikes + perf.avgShares + perf.avgReplies,
          bestTone: this.getBestTone(personaKey),
          improvementRate: this.getImprovementRate(personaKey)
        };
      } else {
        summary[personaKey] = {
          totalPosts: 0,
          avgEngagement: 0,
          bestTone: 'unknown',
          improvementRate: 0
        };
      }
    });
    
    return summary;
  }

  getBestTone(personaKey) {
    const perf = this.state.performance[personaKey];
    const tones = perf.learningData.toneEffectiveness;
    
    let bestTone = 'unknown';
    let bestEffectiveness = 0;
    
    Object.entries(tones).forEach(([tone, data]) => {
      if (data.effectiveness > bestEffectiveness && data.uses >= 2) {
        bestEffectiveness = data.effectiveness;
        bestTone = tone;
      }
    });
    
    return bestTone;
  }

  getImprovementRate(personaKey) {
    const perf = this.state.performance[personaKey];
    const posts = perf.posts;
    
    if (posts.length < 10) return 0;
    
    // Compare recent posts vs earlier posts
    const recentPosts = posts.slice(0, Math.floor(posts.length / 2));
    const earlierPosts = posts.slice(Math.floor(posts.length / 2));
    
    const recentAvg = recentPosts.reduce((sum, p) => sum + p.metrics.totalEngagement, 0) / recentPosts.length;
    const earlierAvg = earlierPosts.reduce((sum, p) => sum + p.metrics.totalEngagement, 0) / earlierPosts.length;
    
    return earlierAvg > 0 ? (recentAvg - earlierAvg) / earlierAvg : 0;
  }
}

export const performanceTracker = new PerformanceTracker();
