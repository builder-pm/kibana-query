// src/agent/tools/elasticsearch/ConsensusTool.js

/**
 * ConsensusTool
 * 
 * Analyzes multiple generated query options, evaluates their quality,
 * and ranks them based on various criteria including precision, recall,
 * complexity, and performance implications.
 */
class ConsensusTool {
  constructor() {
    this.name = 'consensusAnalysis';
    this.description = 'Analyzes and ranks multiple query options to find the optimal approach';
  }

  /**
   * Execute the consensus analysis on multiple query options
   * 
   * @param {Object} params - Parameters for consensus analysis
   * @param {Array<Object>} params.queryOptions - Array of query options to evaluate
   * @param {Object} params.intent - The parsed user intent
   * @param {Object} params.schema - Schema information for context
   * @returns {Object} Ranked queries with explanations
   */
  async execute(params) {
    const { queryOptions = [], intent = {}, schema = {} } = params;
    
    if (!queryOptions || !Array.isArray(queryOptions) || queryOptions.length === 0) {
      throw new Error('No query options provided for analysis');
    }
    
    try {
      // Evaluate each query option
      const evaluatedQueries = queryOptions.map((option, index) => {
        const evaluation = this.evaluateQueryOption(option, intent, schema);
        return {
          id: `option_${index + 1}`,
          originalQuery: option,
          ...evaluation
        };
      });
      
      // Rank queries by overall score (descending)
      const rankedQueries = [...evaluatedQueries].sort((a, b) => {
        return b.overallScore - a.overallScore;
      });
      
      // Determine consensus approach and build response
      const result = {
        recommendedQuery: rankedQueries[0]?.originalQuery || null,
        recommendedQueryId: rankedQueries[0]?.id || null,
        evaluatedOptions: rankedQueries,
        consensusApproach: this.determineConsensusApproach(rankedQueries),
        reasoning: this.generateConsensusReasoning(rankedQueries),
        alternativeApproaches: this.extractAlternativeApproaches(rankedQueries)
      };
      
      return result;
    } catch (error) {
      console.error('Error in consensus analysis:', error);
      throw new Error(`Failed to analyze query options: ${error.message}`);
    }
  }
  
  /**
   * Evaluate a single query option against multiple criteria
   */
  evaluateQueryOption(query, intent, schema) {
    // Initialize scores for different dimensions
    const evaluation = {
      precision: this.evaluatePrecision(query, intent),
      recall: this.evaluateRecall(query, intent),
      complexity: this.evaluateComplexity(query),
      performance: this.evaluatePerformance(query, schema),
      schemaAlignment: this.evaluateSchemaAlignment(query, schema),
      strengths: [],
      weaknesses: [],
      explanation: ''
    };
    
    // Calculate overall score (weighted sum of dimensions)
    evaluation.overallScore = (
      evaluation.precision.score * 0.3 +
      evaluation.recall.score * 0.25 +
      evaluation.complexity.score * 0.15 +
      evaluation.performance.score * 0.2 +
      evaluation.schemaAlignment.score * 0.1
    );
    
    // Determine strengths and weaknesses
    this.determineStrengthsAndWeaknesses(evaluation);
    
    // Generate natural language explanation
    evaluation.explanation = this.generateExplanation(evaluation, intent);
    
    return evaluation;
  }
  
  /**
   * Evaluate the precision of a query (how specific and targeted it is)
   */
  evaluatePrecision(query, intent) {
    let score = 0.5; // Default middle score
    const reasons = [];
    
    // Check for field specificity
    if (this.hasSpecificFieldFilters(query)) {
      score += 0.2;
      reasons.push('Uses specific field filters that match the intent');
    } else {
      score -= 0.1;
      reasons.push('Uses overly broad field selection');
    }
    
    // Check for appropriate filtering
    if (this.hasAppropriateFiltering(query, intent)) {
      score += 0.2;
      reasons.push('Contains appropriate filtering conditions');
    } else {
      score -= 0.1;
      reasons.push('Missing important filtering conditions');
    }
    
    // Check for exact term usage when appropriate
    if (intent.exactMatching && this.usesExactMatching(query)) {
      score += 0.1;
      reasons.push('Correctly uses exact term matching');
    }
    
    // Cap the score between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    return {
      score,
      reasons
    };
  }
  
  /**
   * Evaluate the recall of a query (how comprehensive it is)
   */
  evaluateRecall(query, intent) {
    let score = 0.5; // Default middle score
    const reasons = [];
    
    // Check for appropriate use of wildcards/fuzzy matching
    if (intent.fuzzyMatching && this.usesFuzzyMatching(query)) {
      score += 0.2;
      reasons.push('Uses fuzzy matching to increase recall');
    }
    
    // Check for use of boolean OR or should clauses when appropriate
    if (intent.alternativeTerms && this.usesAlternatives(query)) {
      score += 0.2;
      reasons.push('Incorporates alternative terms or synonyms');
    } else if (intent.alternativeTerms) {
      score -= 0.1;
      reasons.push('Missing important alternative terms');
    }
    
    // Check for too many restrictive filters
    if (this.hasTooManyFilters(query)) {
      score -= 0.2;
      reasons.push('Contains too many restrictive filters that may exclude relevant results');
    }
    
    // Cap the score between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    return {
      score,
      reasons
    };
  }
  
  /**
   * Evaluate the complexity of a query
   */
  evaluateComplexity(query) {
    let score = 1.0; // Start with perfect score and subtract for complexity
    const reasons = [];
    
    // Check nesting depth
    const nestingDepth = this.calculateQueryNestingDepth(query);
    if (nestingDepth > 3) {
      score -= 0.3;
      reasons.push(`Deep nesting (depth: ${nestingDepth}) adds unnecessary complexity`);
    } else if (nestingDepth > 2) {
      score -= 0.1;
      reasons.push('Moderate nesting depth');
    } else {
      reasons.push('Good query structure with appropriate nesting');
    }
    
    // Check boolean clause count
    const booleanClauseCount = this.countBooleanClauses(query);
    if (booleanClauseCount > 10) {
      score -= 0.3;
      reasons.push(`High number of boolean clauses (${booleanClauseCount})`);
    } else if (booleanClauseCount > 6) {
      score -= 0.15;
      reasons.push(`Moderate number of boolean clauses (${booleanClauseCount})`);
    } else {
      reasons.push('Appropriate number of boolean clauses');
    }
    
    // Check for unnecessary script usage
    if (this.hasScriptFiltering(query)) {
      score -= 0.2;
      reasons.push('Uses script filtering which could be replaced with simpler clauses');
    }
    
    // Cap the score between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    return {
      score,
      reasons
    };
  }
  
  /**
   * Evaluate potential performance implications of a query
   */
  evaluatePerformance(query, schema) {
    let score = 0.8; // Start with good score and adjust
    const reasons = [];
    
    // Check for wildcard prefix queries
    if (this.hasLeadingWildcards(query)) {
      score -= 0.3;
      reasons.push('Contains leading wildcards which can severely impact performance');
    }
    
    // Check for appropriate field usage based on schema
    if (this.usesNonIndexedFields(query, schema)) {
      score -= 0.2;
      reasons.push('References fields that may not be optimally indexed');
    }
    
    // Check for large result sets without pagination
    if (this.requestsLargeResults(query)) {
      score -= 0.2;
      reasons.push('Requests large result set without proper pagination');
    }
    
    // Check for fielddata on text fields
    if (this.usesFielddataOnText(query)) {
      score -= 0.2;
      reasons.push('Uses fielddata on text fields which can consume significant memory');
    }
    
    // Add bonus for queries that use filters instead of queries when appropriate
    if (this.usesFiltersAppropriately(query)) {
      score += 0.1;
      reasons.push('Appropriately uses filter context for cacheable clauses');
      // Cap at 1.0
      score = Math.min(1, score);
    }
    
    // Cap the score between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    return {
      score,
      reasons
    };
  }
  
  /**
   * Evaluate how well the query aligns with the provided schema
   */
  evaluateSchemaAlignment(query, schema) {
    let score = 0.7; // Start with decent score and adjust
    const reasons = [];
    
    // Skip detailed evaluation if no schema provided
    if (!schema || !schema.mappings || !schema.mappings.properties) {
      return {
        score: 0.5,
        reasons: ['Schema information not available for detailed evaluation']
      };
    }
    
    // Check if query uses fields that exist in schema
    const unknownFields = this.findUnknownFields(query, schema);
    if (unknownFields.length > 0) {
      score -= 0.2;
      reasons.push(`References fields not in schema: ${unknownFields.join(', ')}`);
    } else {
      score += 0.1;
      reasons.push('All referenced fields exist in schema');
    }
    
    // Check for appropriate query types based on field types
    const fieldTypeIssues = this.checkFieldTypeUsage(query, schema);
    if (fieldTypeIssues.length > 0) {
      score -= 0.2;
      reasons.push(...fieldTypeIssues);
    } else {
      score += 0.1;
      reasons.push('Query operations match field types');
    }
    
    // Cap the score between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    return {
      score,
      reasons
    };
  }
  
  /**
   * Determine the strengths and weaknesses of a query based on its evaluation
   */
  determineStrengthsAndWeaknesses(evaluation) {
    // Find top strengths (highest scoring dimensions)
    const dimensions = ['precision', 'recall', 'complexity', 'performance', 'schemaAlignment'];
    const sortedByScore = [...dimensions].sort((a, b) => evaluation[b].score - evaluation[a].score);
    
    // Top 2 strengths
    evaluation.strengths = sortedByScore.slice(0, 2)
      .filter(dim => evaluation[dim].score >= 0.6) // Only include actual strengths
      .map(dim => {
        const topReason = evaluation[dim].reasons[0] || `Good ${dim}`;
        return `${dim.charAt(0).toUpperCase() + dim.slice(1)}: ${topReason}`;
      });
    
    // Bottom 2 weaknesses
    evaluation.weaknesses = sortedByScore.slice(-2)
      .filter(dim => evaluation[dim].score <= 0.5) // Only include actual weaknesses
      .map(dim => {
        const worstReason = evaluation[dim].reasons[evaluation[dim].reasons.length - 1] || `Poor ${dim}`;
        return `${dim.charAt(0).toUpperCase() + dim.slice(1)}: ${worstReason}`;
      });
  }
  
  /**
   * Generate a natural language explanation of the query evaluation
   */
  generateExplanation(evaluation, intent) {
    const overallScore = evaluation.overallScore;
    let qualityLevel = '';
    
    if (overallScore >= 0.8) {
      qualityLevel = 'excellent';
    } else if (overallScore >= 0.6) {
      qualityLevel = 'good';
    } else if (overallScore >= 0.4) {
      qualityLevel = 'fair';
    } else {
      qualityLevel = 'poor';
    }
    
    let explanation = `This is a ${qualityLevel} query with an overall score of ${overallScore.toFixed(2)}. `;
    
    if (evaluation.strengths.length > 0) {
      explanation += `Its main strengths are: ${evaluation.strengths.join('; ')}. `;
    }
    
    if (evaluation.weaknesses.length > 0) {
      explanation += `Areas for improvement include: ${evaluation.weaknesses.join('; ')}. `;
    }
    
    return explanation;
  }
  
  /**
   * Determine the consensus approach from ranked queries
   */
  determineConsensusApproach(rankedQueries) {
    if (rankedQueries.length === 0) return null;
    
    // Extract key characteristics from top queries
    const topN = rankedQueries.slice(0, Math.min(3, rankedQueries.length));
    
    // Identify common patterns in the top queries
    const commonPatterns = this.findCommonPatterns(topN);
    
    return {
      description: this.generateConsensusDescription(commonPatterns, topN),
      keyElements: commonPatterns
    };
  }
  
  /**
   * Find common patterns across multiple queries
   */
  findCommonPatterns(queries) {
    const patterns = {
      queryTypes: this.findCommonQueryTypes(queries),
      fields: this.findCommonFields(queries),
      filters: this.findCommonFilters(queries),
      aggregations: this.findCommonAggregations(queries)
    };
    
    return patterns;
  }
  
  /**
   * Generate a description of the consensus approach
   */
  generateConsensusDescription(patterns, topQueries) {
    const { queryTypes, fields, filters, aggregations } = patterns;
    
    let description = 'The optimal approach ';
    
    // Describe query type consensus
    if (queryTypes.length > 0) {
      description += `uses ${queryTypes.join(' and ')} queries `;
    } else {
      description += 'has no strong consensus on query type ';
    }
    
    // Describe field consensus
    if (fields.length > 0) {
      description += `focusing on the ${fields.join(', ')} field(s) `;
    }
    
    // Describe filter consensus
    if (filters.length > 0) {
      description += `with filtering on ${filters.join(' and ')} `;
    }
    
    // Describe aggregation consensus if present
    if (aggregations.length > 0) {
      description += `and includes ${aggregations.join(', ')} aggregations`;
    }
    
    description += '.';
    return description;
  }
  
  /**
   * Generate reasoning for the consensus approach
   */
  generateConsensusReasoning(rankedQueries) {
    if (rankedQueries.length === 0) return '';
    
    const topQuery = rankedQueries[0];
    let reasoning = 
      `The recommended query approach achieves an overall score of ${topQuery.overallScore.toFixed(2)}. `;
    
    // Add key strength explanation
    reasoning += topQuery.strengths.length > 0 ? 
      `Key strengths: ${topQuery.strengths.join('; ')}. ` : 
      '';
    
    return reasoning;
  }
  
  /**
   * Extract alternative approaches from ranked queries
   */
  extractAlternativeApproaches(rankedQueries) {
    if (rankedQueries.length <= 1) return [];
    
    const alternatives = [];
    
    // Consider up to 2 alternatives beyond the top query
    for (let i = 1; i < Math.min(3, rankedQueries.length); i++) {
      const query = rankedQueries[i];
      
      // Only include alternatives that aren't too poor
      if (query.overallScore < 0.3) continue;
      
      alternatives.push({
        id: query.id,
        score: query.overallScore,
        strengths: query.strengths,
        explanation: `Alternative ${i}: ${query.explanation}`
      });
    }
    
    return alternatives;
  }
  
  // Helper methods for query analysis
  
  /**
   * Check if the query has specific field filters
   */
  hasSpecificFieldFilters(query) {
    // Implementation would check if the query targets specific fields
    return true; // Simplified implementation for demo
  }
  
  /**
   * Check if the query has appropriate filtering based on intent
   */
  hasAppropriateFiltering(query, intent) {
    // Implementation would analyze query filters against the intent
    return true; // Simplified implementation for demo
  }
  
  /**
   * Check if query uses exact term matching
   */
  usesExactMatching(query) {
    // Check for term queries instead of match when appropriate
    return this.hasQueryType(query, 'term');
  }
  
  /**
   * Check if query uses fuzzy matching
   */
  usesFuzzyMatching(query) {
    return this.hasQueryType(query, 'fuzzy') || 
           this.hasQueryTypeWithParam(query, 'match', 'fuzziness');
  }
  
  /**
   * Check if query includes alternative terms
   */
  usesAlternatives(query) {
    // Check for should clauses or synonyms
    return this.hasBoolShouldClauses(query);
  }
  
  /**
   * Check if query has too many restrictive filters
   */
  hasTooManyFilters(query) {
    const filterCount = this.countFilters(query);
    return filterCount > 5; // Arbitrary threshold for demonstration
  }
  
  /**
   * Calculate the nesting depth of a query
   */
  calculateQueryNestingDepth(query, depth = 0) {
    if (!query || typeof query !== 'object') return depth;
    
    let maxDepth = depth;
    
    if (query.bool) {
      // Boolean query - check each clause type
      const clauses = ['must', 'should', 'must_not', 'filter'];
      for (const clause of clauses) {
        if (Array.isArray(query.bool[clause])) {
          for (const subQuery of query.bool[clause]) {
            const subDepth = this.calculateQueryNestingDepth(subQuery, depth + 1);
            maxDepth = Math.max(maxDepth, subDepth);
          }
        }
      }
    }
    
    return maxDepth;
  }
  
  /**
   * Count the number of boolean clauses in a query
   */
  countBooleanClauses(query) {
    let count = 0;
    
    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.bool) {
        // Count each clause in the bool query
        const clauses = ['must', 'should', 'must_not', 'filter'];
        for (const clause of clauses) {
          if (Array.isArray(obj.bool[clause])) {
            count += obj.bool[clause].length;
            // Recurse into each clause
            obj.bool[clause].forEach(traverse);
          }
        }
      } else {
        // Recurse into other objects
        for (const key in obj) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            traverse(obj[key]);
          }
        }
      }
    };
    
    traverse(query);
    return count;
  }
  
  /**
   * Check if the query uses script filtering
   */
  hasScriptFiltering(query) {
    // Implementation would check for script filters
    return this.hasQueryType(query, 'script'); 
  }
  
  /**
   * Check if the query has leading wildcards
   */
  hasLeadingWildcards(query) {
    // Implementation would check for wildcards at the beginning of terms
    return false; // Simplified implementation for demo
  }
  
  /**
   * Check if the query uses non-indexed fields
   */
  usesNonIndexedFields(query, schema) {
    // Implementation would check query fields against schema
    return false; // Simplified implementation for demo
  }
  
  /**
   * Check if the query requests large result sets
   */
  requestsLargeResults(query) {
    return query.size !== undefined && query.size > 10000;
  }
  
  /**
   * Check if query uses fielddata on text fields
   */
  usesFielddataOnText(query) {
    // Implementation would check for fielddata usage
    return false; // Simplified implementation for demo
  }
  
  /**
   * Check if query uses filter context appropriately
   */
  usesFiltersAppropriately(query) {
    // Implementation would check for filter usage in appropriate places
    return query.query && query.query.bool && query.query.bool.filter;
  }
  
  /**
   * Find fields in the query that don't exist in the schema
   */
  findUnknownFields(query, schema) {
    const unknownFields = [];
    // Implementation would extract fields from query and check against schema
    return unknownFields; // Simplified implementation for demo
  }
  
  /**
   * Check for appropriate field type usage in the query
   */
  checkFieldTypeUsage(query, schema) {
    const issues = [];
    // Implementation would check query operations against field types
    return issues; // Simplified implementation for demo
  }
  
  /**
   * Find common query types across multiple queries
   */
  findCommonQueryTypes(queries) {
    // Implementation would extract and compare query types
    return ['term', 'match']; // Simplified implementation for demo
  }
  
  /**
   * Find common fields across multiple queries
   */
  findCommonFields(queries) {
    // Implementation would extract and compare fields
    return ['title', 'content']; // Simplified implementation for demo
  }
  
  /**
   * Find common filters across multiple queries
   */
  findCommonFilters(queries) {
    // Implementation would extract and compare filters
    return ['date range', 'status']; // Simplified implementation for demo
  }
  
  /**
   * Find common aggregations across multiple queries
   */
  findCommonAggregations(queries) {
    // Implementation would extract and compare aggregations
    return []; // Simplified implementation for demo
  }
  
  /**
   * Check if query contains a specific query type
   */
  hasQueryType(query, type) {
    if (!query) return false;
    
    let found = false;
    
    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj[type] !== undefined) {
        found = true;
        return;
      }
      
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          traverse(obj[key]);
          if (found) return;
        }
      }
    };
    
    traverse(query);
    return found;
  }
  
  /**
   * Check if query contains a specific query type with a parameter
   */
  hasQueryTypeWithParam(query, type, param) {
    if (!query) return false;
    
    let found = false;
    
    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj[type] && obj[type][param] !== undefined) {
        found = true;
        return;
      }
      
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          traverse(obj[key]);
          if (found) return;
        }
      }
    };
    
    traverse(query);
    return found;
  }
  
  /**
   * Check if a query has bool should clauses
   */
  hasBoolShouldClauses(query) {
    if (!query) return false;
    
    let found = false;
    
    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.bool && Array.isArray(obj.bool.should) && obj.bool.should.length > 0) {
        found = true;
        return;
      }
      
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          traverse(obj[key]);
          if (found) return;
        }
      }
    };
    
    traverse(query);
    return found;
  }
  
  /**
   * Count the number of filters in a query
   */
  countFilters(query) {
    let count = 0;
    
    const traverse = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Count bool filter clauses
      if (obj.bool && Array.isArray(obj.bool.filter)) {
        count += obj.bool.filter.length;
        obj.bool.filter.forEach(traverse);
      }
      
      // Count bool must_not clauses
      if (obj.bool && Array.isArray(obj.bool.must_not)) {
        count += obj.bool.must_not.length;
        obj.bool.must_not.forEach(traverse);
      }
      
      // Recurse into other objects
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          traverse(obj[key]);
        }
      }
    };
    
    traverse(query);
    return count;
  }
}

export default ConsensusTool;
