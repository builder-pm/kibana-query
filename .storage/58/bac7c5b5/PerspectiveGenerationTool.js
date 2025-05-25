// src/agent/tools/elasticsearch/PerspectiveGenerationTool.js

/**
 * PerspectiveGenerationTool
 * 
 * This tool takes a parsed intent from natural language input and generates
 * multiple perspectives or approaches for crafting Elasticsearch queries.
 * Each perspective represents a different strategy to fulfill the user's intent.
 */
class PerspectiveGenerationTool {
  constructor() {
    this.name = 'generatePerspectives';
    this.description = 'Generates multiple analytical approaches for an Elasticsearch query';
  }

  /**
   * Executes the perspective generation process based on the parsed intent
   * 
   * @param {Object} params - The parameters for perspective generation
   * @param {Object} params.intent - The parsed intent from IntentParsingTool
   * @param {Object} params.context - Context information (schema, cluster info, etc.)
   * @returns {Array} - Array of perspective objects
   */
  async execute(params) {
    const { intent, context } = params;
    
    if (!intent || !intent.queryType) {
      throw new Error('Invalid intent provided to PerspectiveGenerationTool');
    }

    // Generate perspectives based on query type
    let perspectives = [];
    
    switch (intent.queryType) {
      case 'search':
        perspectives = this.generateSearchPerspectives(intent, context);
        break;
      case 'aggregation':
        perspectives = this.generateAggregationPerspectives(intent, context);
        break;
      case 'analytics':
        perspectives = this.generateAnalyticsPerspectives(intent, context);
        break;
      default:
        // Default to search if type is unknown
        perspectives = this.generateSearchPerspectives(intent, context);
    }
    
    // Sort perspectives by confidence
    perspectives.sort((a, b) => b.confidence - a.confidence);
    
    // Limit to 3 perspectives max
    return perspectives.slice(0, 3);
  }

  /**
   * Generates search-oriented perspectives
   * 
   * @param {Object} intent - The parsed query intent
   * @param {Object} context - The query context
   * @returns {Array} - Array of perspective objects
   */
  generateSearchPerspectives(intent, context) {
    const { entities, complexity } = intent;
    const { schema } = context;
    const perspectives = [];
    
    // Perspective 1: Precise match (high precision)
    perspectives.push({
      id: 'precise-match',
      name: 'Precise Match',
      description: 'Returns exact matches to search criteria with high precision',
      confidence: this.calculatePreciseMatchConfidence(intent, context),
      approach: 'Uses strict, term-level queries with exact field matching. Prioritizes precision over recall.',
      queryParams: {
        strictMode: true,
        boostExactMatches: true,
        minimumShouldMatch: '100%',
        fuzzy: false
      }
    });
    
    // Perspective 2: Enhanced recall (for broader results)
    perspectives.push({
      id: 'enhanced-recall',
      name: 'Enhanced Recall',
      description: 'Broadens search to include more potential matches',
      confidence: this.calculateEnhancedRecallConfidence(intent, context),
      approach: 'Incorporates fuzzy matching, synonyms, and relaxed constraints to find more potential matches.',
      queryParams: {
        strictMode: false,
        boostExactMatches: false,
        minimumShouldMatch: '75%',
        fuzzy: true,
        fuzziness: 'AUTO'
      }
    });
    
    // Perspective 3: Relevance-optimized (balanced approach)
    perspectives.push({
      id: 'relevance-optimized',
      name: 'Relevance Optimized',
      description: 'Balances precision and recall with sophisticated scoring',
      confidence: this.calculateRelevanceOptimizedConfidence(intent, context),
      approach: 'Uses advanced relevance features like multi_match with cross_fields and sophisticated boosting.',
      queryParams: {
        strictMode: false,
        boostExactMatches: true,
        minimumShouldMatch: '85%',
        useMultiMatch: true,
        multiMatchType: 'cross_fields',
        tieBreaker: 0.3
      }
    });
    
    // For complex queries, add an aggregation perspective
    if (complexity === 'complex' || complexity === 'medium') {
      perspectives.push({
        id: 'search-with-aggregations',
        name: 'Search with Analytics',
        description: 'Combines search with analytics for deeper insights',
        confidence: 0.7,
        approach: 'Performs the search while simultaneously calculating relevant aggregations on the matching documents.',
        queryParams: {
          includeAggregations: true,
          aggregationFields: this.suggestAggregationFields(intent, context),
          size: 10
        }
      });
    }
    
    return perspectives;
  }

  /**
   * Generates aggregation-oriented perspectives
   * 
   * @param {Object} intent - The parsed query intent
   * @param {Object} context - The query context
   * @returns {Array} - Array of perspective objects
   */
  generateAggregationPerspectives(intent, context) {
    const { entities } = intent;
    const perspectives = [];
    
    // Perspective 1: Standard aggregations
    perspectives.push({
      id: 'standard-aggregations',
      name: 'Standard Analytics',
      description: 'Provides basic analytics using standard aggregations',
      confidence: 0.9,
      approach: 'Uses bucket aggregations with sub-aggregations for metrics.',
      queryParams: {
        size: 0, // No search hits, only aggregations
        aggregationType: 'standard',
        includeSubAggregations: true
      }
    });
    
    // Perspective 2: Time series analysis (if time-based fields are present)
    if (this.hasTimeBasedFields(intent, context)) {
      perspectives.push({
        id: 'time-series',
        name: 'Time Series Analysis',
        description: 'Analyzes trends over time intervals',
        confidence: 0.85,
        approach: 'Uses date_histogram aggregation with appropriate intervals and metrics.',
        queryParams: {
          size: 0,
          aggregationType: 'time-series',
          interval: this.suggestTimeInterval(intent, context),
          includeSubAggregations: true
        }
      });
    }
    
    // Perspective 3: Multi-dimensional analysis
    perspectives.push({
      id: 'multi-dimensional',
      name: 'Multi-Dimensional Analysis',
      description: 'Analyzes data across multiple dimensions',
      confidence: 0.75,
      approach: 'Uses nested aggregations to analyze relationships between multiple fields.',
      queryParams: {
        size: 0,
        aggregationType: 'multi-dimensional',
        dimensions: this.suggestDimensions(intent, context),
        includeSubAggregations: true
      }
    });
    
    return perspectives;
  }

  /**
   * Generates analytics-oriented perspectives
   * 
   * @param {Object} intent - The parsed query intent
   * @param {Object} context - The query context
   * @returns {Array} - Array of perspective objects
   */
  generateAnalyticsPerspectives(intent, context) {
    const { entities } = intent;
    const perspectives = [];
    
    // Perspective 1: Statistical analysis
    perspectives.push({
      id: 'statistical',
      name: 'Statistical Analysis',
      description: 'Provides comprehensive statistical metrics on numeric fields',
      confidence: 0.8,
      approach: 'Uses extended_stats aggregation for detailed statistical analysis.',
      queryParams: {
        size: 0,
        aggregationType: 'stats',
        extendedStats: true,
        percentiles: true
      }
    });
    
    // Perspective 2: Top items analysis
    perspectives.push({
      id: 'top-items',
      name: 'Top Items Analysis',
      description: 'Identifies the most common values or top performers',
      confidence: 0.85,
      approach: 'Uses terms aggregation with high size parameter and order by metrics.',
      queryParams: {
        size: 0,
        aggregationType: 'terms',
        termsSize: 20,
        orderBy: '_count',
        order: 'desc'
      }
    });
    
    // Perspective 3: Comparative analysis
    perspectives.push({
      id: 'comparative',
      name: 'Comparative Analysis',
      description: 'Compares metrics across different segments',
      confidence: 0.75,
      approach: 'Uses filters or significant terms to compare different segments of data.',
      queryParams: {
        size: 0,
        aggregationType: 'comparative',
        compareBy: this.suggestComparisonDimension(intent, context)
      }
    });
    
    return perspectives;
  }

  /**
   * Calculates confidence score for precise match perspective
   */
  calculatePreciseMatchConfidence(intent, context) {
    // Higher confidence for well-defined queries
    let confidence = 0.8;
    
    // Adjust confidence based on factors:
    
    // 1. Query clarity and specificity
    if (intent.entities && Object.keys(intent.entities).length > 1) {
      confidence += 0.05; // Multiple entities usually mean clearer query
    }
    
    // 2. Low complexity favors precise matching
    if (intent.complexity === 'simple') {
      confidence += 0.1;
    } else if (intent.complexity === 'complex') {
      confidence -= 0.1;
    }
    
    // 3. If user is explicitly looking for exact matches
    if (intent.exactMatch) {
      confidence += 0.1;
    }
    
    // Ensure confidence is within bounds
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /**
   * Calculates confidence score for enhanced recall perspective
   */
  calculateEnhancedRecallConfidence(intent, context) {
    // Start with base confidence
    let confidence = 0.7;
    
    // Adjust based on factors:
    
    // 1. Query type and wording suggesting broader search
    if (intent.broadMatch) {
      confidence += 0.15;
    }
    
    // 2. Higher complexity often benefits from broader search
    if (intent.complexity === 'complex') {
      confidence += 0.1;
    } else if (intent.complexity === 'simple') {
      confidence -= 0.05;
    }
    
    // 3. If query contains terms like "similar", "related", etc.
    if (intent.similaritySearch) {
      confidence += 0.15;
    }
    
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /**
   * Calculates confidence score for relevance optimized perspective
   */
  calculateRelevanceOptimizedConfidence(intent, context) {
    // This is generally a good balanced approach
    let confidence = 0.85;
    
    // Adjust based on factors:
    
    // 1. Medium complexity is ideal for this approach
    if (intent.complexity === 'medium') {
      confidence += 0.05;
    } else if (intent.complexity === 'complex') {
      confidence -= 0.05;
    }
    
    // 2. If schema has multiple text fields, this approach works better
    if (context.schema && context.schema.analysis && 
        context.schema.analysis.searchableFields &&
        context.schema.analysis.searchableFields.length > 3) {
      confidence += 0.05;
    }
    
    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /**
   * Checks if the intent involves time-based fields
   */
  hasTimeBasedFields(intent, context) {
    // Check if any time/date fields are mentioned in the intent
    if (intent.entities) {
      for (const key in intent.entities) {
        if (key.toLowerCase().includes('date') || 
            key.toLowerCase().includes('time') ||
            key.toLowerCase().includes('timestamp')) {
          return true;
        }
      }
    }
    
    // Check if schema has date fields that might be relevant
    if (context.schema && context.schema.analysis && context.schema.analysis.dateFields) {
      return context.schema.analysis.dateFields.length > 0;
    }
    
    return false;
  }

  /**
   * Suggests a time interval for time-series analysis
   */
  suggestTimeInterval(intent, context) {
    // Try to infer appropriate time interval from intent
    if (intent.entities) {
      const timeEntity = Object.entries(intent.entities).find(([key]) => 
        key.toLowerCase().includes('time') || 
        key.toLowerCase().includes('date') || 
        key.toLowerCase().includes('interval')
      );
      
      if (timeEntity) {
        const [key, value] = timeEntity;
        const valueStr = String(value).toLowerCase();
        
        if (valueStr.includes('hour')) return 'hour';
        if (valueStr.includes('day')) return 'day';
        if (valueStr.includes('week')) return 'week';
        if (valueStr.includes('month')) return 'month';
        if (valueStr.includes('year')) return 'year';
      }
    }
    
    // Default to day if we can't determine
    return 'day';
  }

  /**
   * Suggests dimensions for multi-dimensional analysis
   */
  suggestDimensions(intent, context) {
    const dimensions = [];
    
    // Extract potential dimensions from intent entities
    if (intent.entities) {
      for (const key in intent.entities) {
        // Categories, types, statuses are good candidates for dimensions
        if (key.toLowerCase().includes('category') || 
            key.toLowerCase().includes('type') || 
            key.toLowerCase().includes('status') ||
            key.toLowerCase().includes('group')) {
          dimensions.push(key);
        }
      }
    }
    
    // If no dimensions found in intent, suggest from schema
    if (dimensions.length === 0 && context.schema && context.schema.analysis) {
      // Keyword fields make good dimensions
      const keywordFields = context.schema.analysis.aggregatableFields || [];
      dimensions.push(...keywordFields.slice(0, 2)); // Take top 2
    }
    
    // Ensure at least one dimension
    if (dimensions.length === 0) {
      dimensions.push('unknown_dimension');
    }
    
    return dimensions;
  }

  /**
   * Suggests fields for aggregations based on intent and schema
   */
  suggestAggregationFields(intent, context) {
    const fields = [];
    
    // Extract potential aggregation fields from intent entities
    if (intent.entities) {
      for (const key in intent.entities) {
        if (key.toLowerCase().includes('count') || 
            key.toLowerCase().includes('sum') || 
            key.toLowerCase().includes('average') ||
            key.toLowerCase().includes('min') ||
            key.toLowerCase().includes('max')) {
          fields.push(key);
        }
      }
    }
    
    // If no fields found in intent, suggest from schema
    if (fields.length === 0 && context.schema && context.schema.analysis) {
      // Numeric fields are good for aggregations
      const numericFields = context.schema.analysis.aggregatableFields || [];
      fields.push(...numericFields.slice(0, 2)); // Take top 2
    }
    
    return fields;
  }

  /**
   * Suggests a dimension for comparative analysis
   */
  suggestComparisonDimension(intent, context) {
    // Try to find comparison terms in the intent
    if (intent.entities) {
      for (const key in intent.entities) {
        if (key.toLowerCase().includes('compare') || 
            key.toLowerCase().includes('versus') || 
            key.toLowerCase().includes('vs')) {
          return { dimension: key, values: intent.entities[key] };
        }
      }
      
      // Look for categorical fields that might be used for comparison
      for (const key in intent.entities) {
        if (key.toLowerCase().includes('category') || 
            key.toLowerCase().includes('type') || 
            key.toLowerCase().includes('status')) {
          return { dimension: key, values: intent.entities[key] };
        }
      }
    }
    
    // Default comparison dimension if none found
    return { dimension: 'unknown_dimension', values: ['A', 'B'] };
  }
}

export default PerspectiveGenerationTool;
