// src/agent/tools/elasticsearch/ConsensusTool.js

/**
 * ConsensusTool
 * 
 * This tool analyzes multiple generated query options, evaluates their quality,
 * and ranks them based on various criteria to provide the best recommendations
 * to the user. It acts as a decision-making layer on top of other tools.
 */
class ConsensusTool {
  constructor() {
    this.name = 'consensus';
    this.description = 'Ranks query options and provides recommendations';
  }

  /**
   * Executes the consensus process on multiple query options
   * 
   * @param {Object} params - The parameters for consensus generation
   * @param {Array} params.queries - Array of validated query results to evaluate
   * @param {Object} params.context - Context information (schema, user intent, etc.)
   * @returns {Array} - Ranked array of query results with explanations
   */
  async execute(params) {
    const { queries, context } = params;
    
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      throw new Error('Invalid queries provided to ConsensusTool');
    }

    // Process the queries to add ranking information
    const rankedQueries = this.rankQueries(queries, context);
    
    // Add explanations and recommendations
    const enrichedQueries = this.addExplanationsAndRecommendations(rankedQueries, context);
    
    // Sort by final score (descending)
    enrichedQueries.sort((a, b) => b.rankingScore - a.rankingScore);
    
    return enrichedQueries;
  }

  /**
   * Rank queries based on multiple criteria
   */
  rankQueries(queries, context) {
    const rankedQueries = queries.map(query => {
      // Start with base score from confidence
      let rankingScore = query.perspective.confidence * 0.5; // 50% weight from confidence
      
      // Validation score - higher if query has no errors
      const validationScore = this.calculateValidationScore(query);
      rankingScore += validationScore * 0.2; // 20% weight
      
      // Relevance score - how well the query matches user intent
      const relevanceScore = this.calculateRelevanceScore(query, context);
      rankingScore += relevanceScore * 0.2; // 20% weight
      
      // Performance score - efficiency considerations
      const performanceScore = this.calculatePerformanceScore(query);
      rankingScore += performanceScore * 0.1; // 10% weight
      
      return {
        ...query,
        rankingScore,
        scores: {
          validationScore,
          relevanceScore, 
          performanceScore
        }
      };
    });
    
    return rankedQueries;
  }

  /**
   * Calculate validation score based on errors and warnings
   */
  calculateValidationScore(query) {
    if (!query.validation) {
      return 0.5; // Default score if validation missing
    }
    
    // Start with perfect score
    let score = 1.0;
    
    // Errors are major issues
    if (query.validation.errors && query.validation.errors.length > 0) {
      // Each error reduces score significantly
      score -= query.validation.errors.length * 0.3;
    }
    
    // Warnings are minor issues
    if (query.validation.warnings && query.validation.warnings.length > 0) {
      // Each warning reduces score less significantly
      score -= query.validation.warnings.length * 0.05;
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate relevance score based on how well query matches intent
   */
  calculateRelevanceScore(query, context) {
    // Default score if no context provided
    if (!context || !context.userInput) {
      return 0.7;
    }
    
    // Start with moderate score
    let score = 0.7;
    
    // Analyze query complexity vs. intent complexity
    const userInput = context.userInput.toLowerCase();
    const queryJson = JSON.stringify(query.query).toLowerCase();
    
    // Check if key terms from user input appear in the query
    const keyTerms = this.extractKeyTerms(userInput);
    const matchedTerms = keyTerms.filter(term => queryJson.includes(term));
    
    // Score improves based on percentage of matched terms
    if (keyTerms.length > 0) {
      const termMatchRatio = matchedTerms.length / keyTerms.length;
      score += termMatchRatio * 0.2;
    }
    
    // Different query types get bonuses for different intents
    if (userInput.includes('aggregate') || 
        userInput.includes('group') || 
        userInput.includes('count') ||
        userInput.includes('average')) {
      // Bonus for aggregation queries when user wants analytics
      if (queryJson.includes('aggs') || queryJson.includes('aggregations')) {
        score += 0.15;
      }
    }
    
    // Filter/condition checks
    if (userInput.includes('filter') || 
        userInput.includes('where') || 
        userInput.includes('only') ||
        userInput.includes('specific')) {
      // Bonus for filtered queries
      if (queryJson.includes('filter') || queryJson.includes('must') || queryJson.includes('term')) {
        score += 0.10;
      }
    }
    
    // Special handling for time-based queries
    if (userInput.includes('time') || 
        userInput.includes('date') || 
        userInput.includes('period') ||
        userInput.includes('trend')) {
      // Bonus for date queries
      if (queryJson.includes('date') || 
          queryJson.includes('range') || 
          queryJson.includes('histogram') ||
          queryJson.includes('interval')) {
        score += 0.15;
      }
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate performance score based on query efficiency
   */
  calculatePerformanceScore(query) {
    // Default moderate score
    let score = 0.7;
    
    const queryJson = JSON.stringify(query.query);
    
    // Penalize for inefficient constructs
    
    // Wildcard prefix queries are very inefficient
    if (queryJson.includes('"wildcard"') && queryJson.includes('"*')) {
      score -= 0.2;
    }
    
    // Large result sets
    if (query.query.size && query.query.size > 1000) {
      score -= 0.2;
    }
    
    // Large aggregation sizes
    if (queryJson.includes('"size":') && 
        queryJson.match(/[^a-zA-Z0-9]size[^a-zA-Z0-9]*:[^a-zA-Z0-9]*[0-9]{4,}/)) {
      score -= 0.1;
    }
    
    // Bonus for using filters instead of query (more efficient)
    if (queryJson.includes('"filter"')) {
      score += 0.1;
    }
    
    // Bonus for source filtering
    if (queryJson.includes('"_source"')) {
      score += 0.05;
    }
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Add explanations and recommendations to ranked queries
   */
  addExplanationsAndRecommendations(rankedQueries, context) {
    return rankedQueries.map(query => {
      const explanation = this.generateExplanation(query, context);
      const recommendations = this.generateRecommendations(query, context);
      
      return {
        ...query,
        explanation,
        recommendations
      };
    });
  }

  /**
   * Generate human-readable explanation for a query
   */
  generateExplanation(query, context) {
    const { perspective, validation, scores } = query;
    
    // Start with the perspective approach
    let explanation = `This query uses a ${perspective.name} approach: ${perspective.description}. `;
    
    // Add validation assessment
    if (validation && validation.valid) {
      explanation += `The query syntax is valid. `;
    } else if (validation && validation.errors && validation.errors.length > 0) {
      explanation += `The query has ${validation.errors.length} validation errors that may prevent execution. `;
    } else if (validation && validation.warnings && validation.warnings.length > 0) {
      explanation += `The query has ${validation.warnings.length} potential issues to be aware of. `;
    }
    
    // Add scoring explanation
    explanation += `This query ranked ${this.formatPercent(query.rankingScore)} overall `;
    explanation += `with ${this.formatPercent(scores.validationScore)} for validation quality, `;
    explanation += `${this.formatPercent(scores.relevanceScore)} for relevance to your intent, `;
    explanation += `and ${this.formatPercent(scores.performanceScore)} for performance considerations.`;
    
    return explanation;
  }

  /**
   * Generate recommendations for a query
   */
  generateRecommendations(query, context) {
    const recommendations = [];
    const { validation } = query;
    
    // Add validation suggestions
    if (validation && validation.suggestions && validation.suggestions.length > 0) {
      // Add up to 3 suggestions from validation
      recommendations.push(...validation.suggestions.slice(0, 3));
    }
    
    // Add query-specific recommendations
    const queryJson = JSON.stringify(query.query);
    
    // Performance recommendations
    if (query.scores.performanceScore < 0.6) {
      if (!queryJson.includes('"filter"')) {
        recommendations.push('Consider adding filter clauses to improve query performance.');
      }
      
      if (query.query.size && query.query.size > 100 && !queryJson.includes('"_source"')) {
        recommendations.push('Use _source filtering to limit returned fields and improve performance.');
      }
    }
    
    // Add recommendations based on perspective
    if (query.perspective.id === 'precise-match' && query.scores.relevanceScore < 0.7) {
      recommendations.push('This query prioritizes precision. If you need broader results, try the "Enhanced Recall" option.');
    } else if (query.perspective.id === 'enhanced-recall' && queryJson.includes('"size":10')) {
      recommendations.push('Consider increasing size parameter to see more results with this broad matching approach.');
    }
    
    return recommendations.filter((rec, index, self) => 
      // Remove duplicates
      self.indexOf(rec) === index
    ).slice(0, 5); // Limit to 5 recommendations
  }

  /**
   * Extract key terms from user input for relevance matching
   */
  extractKeyTerms(input) {
    // List of common English stopwords to filter out
    const stopwords = [
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 
      'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 
      'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'don', 
      'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 
      'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 
      'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 
      'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 
      'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 's', 
      'same', 'she', 'should', 'so', 'some', 'such', 't', 'than', 'that', 'the', 
      'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 
      'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 
      'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 
      'will', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
    ];
    
    // Filter out stopwords and retain good terms
    return input
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(term => 
        term.length > 2 && // Only terms longer than 2 chars
        !stopwords.includes(term) && // Not a stopword
        !parseInt(term) // Not a pure number
      );
  }

  /**
   * Format a decimal as a percentage
   */
  formatPercent(decimal) {
    return `${Math.round(decimal * 100)}%`;
  }
}

export default ConsensusTool;
