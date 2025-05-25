// src/agent/tools/elasticsearch/PerspectiveGenerationTool.js

/**
 * PerspectiveGenerationTool
 * 
 * Generates multiple analytical approaches (perspectives) for the same query intent.
 * Each perspective provides a different strategy for addressing the user's query,
 * balancing precision, recall, and analytical depth.
 */
class PerspectiveGenerationTool {
  constructor() {
    this.name = 'generatePerspectives';
    this.description = 'Generates multiple analytical approaches for a query intent';
    
    // Define core perspectives
    this.corePerspectives = [
      {
        id: 'precise-match',
        name: 'Precise Match',
        approach: 'Prioritizes exact matching and high precision',
        description: 'This perspective focuses on finding exact matches to the query terms, using strict filters and term-level queries to ensure high precision results.',
        confidence: 0.9
      },
      {
        id: 'enhanced-recall',
        name: 'Enhanced Recall',
        approach: 'Optimizes for broader matching and higher recall',
        description: 'This perspective uses full-text search capabilities to find relevant results even when terms don\'t exactly match, employing fuzzy matching and synonym expansion.',
        confidence: 0.85
      },
      {
        id: 'statistical-analysis',
        name: 'Statistical Analysis',
        approach: 'Provides statistical insights through aggregations',
        description: 'This perspective focuses on extracting analytical insights from the data using aggregations to summarize, group, and analyze patterns.',
        confidence: 0.8
      },
      {
        id: 'time-series',
        name: 'Time Series Analysis',
        approach: 'Analyzes trends and patterns over time',
        description: 'This perspective specializes in time-based analysis, tracking how metrics change over time intervals using date histograms and time-based aggregations.',
        confidence: 0.85
      }
    ];
  }

  /**
   * Execute the perspective generation process
   * 
   * @param {Object} params - The parameters for perspective generation
   * @param {Object} params.intent - The parsed intent from IntentParsingTool
   * @param {Object} params.context - Context information including schema
   * @returns {Promise<Array>} - Array of perspective objects
   */
  async execute(params) {
    const { intent, context = {} } = params;
    
    if (!intent) {
      throw new Error('No intent provided for perspective generation');
    }
    
    try {
      // Select the most appropriate perspectives based on the intent
      const selectedPerspectives = this.selectPerspectives(intent, context);
      
      // Enrich perspectives with intent-specific details
      const enrichedPerspectives = this.enrichPerspectives(selectedPerspectives, intent, context);
      
      return enrichedPerspectives;
    } catch (error) {
      console.error('Error generating perspectives:', error);
      throw new Error(`Failed to generate perspectives: ${error.message}`);
    }
  }
  
  /**
   * Select the most appropriate perspectives based on the intent
   */
  selectPerspectives(intent, context) {
    const { queryType, aggregations, timeframe } = intent;
    const perspectives = [];
    
    // Select perspectives based on query type
    switch (queryType) {
      case 'search':
        // For search queries, always include precision and recall perspectives
        perspectives.push(
          this.corePerspectives.find(p => p.id === 'precise-match'),
          this.corePerspectives.find(p => p.id === 'enhanced-recall')
        );
        break;
        
      case 'aggregation':
        // For aggregation queries, use statistical analysis as primary perspective
        perspectives.push(
          this.corePerspectives.find(p => p.id === 'statistical-analysis')
        );
        
        // If the aggregation involves dates, add time-series perspective
        if (aggregations.some(agg => 
          agg.field && (agg.field.includes('date') || agg.field.includes('time') || agg.field === '@timestamp')
        )) {
          perspectives.push(
            this.corePerspectives.find(p => p.id === 'time-series')
          );
        }
        break;
        
      case 'time_series':
        // For time series queries, use time-series as primary and statistical as secondary
        perspectives.push(
          this.corePerspectives.find(p => p.id === 'time-series'),
          this.corePerspectives.find(p => p.id === 'statistical-analysis')
        );
        break;
        
      case 'geospatial':
        // For geospatial queries, use precision first, then enhance with statistical if needed
        perspectives.push(
          this.corePerspectives.find(p => p.id === 'precise-match')
        );
        
        // If there seems to be an analytical component, add statistical
        if (aggregations && aggregations.length > 0) {
          perspectives.push(
            this.corePerspectives.find(p => p.id === 'statistical-analysis')
          );
        }
        break;
        
      default:
        // Default to precision and recall
        perspectives.push(
          this.corePerspectives.find(p => p.id === 'precise-match'),
          this.corePerspectives.find(p => p.id === 'enhanced-recall')
        );
    }
    
    // Special case: If timeframe is specified but query type isn't time_series,
    // consider adding time-series perspective
    if (timeframe && queryType !== 'time_series' && !perspectives.some(p => p.id === 'time-series')) {
      perspectives.push(
        this.corePerspectives.find(p => p.id === 'time-series')
      );
    }
    
    // Limit to max 3 perspectives
    return perspectives.slice(0, 3);
  }
  
  /**
   * Enrich selected perspectives with intent-specific details
   */
  enrichPerspectives(perspectives, intent, context) {
    // Deep clone the perspectives to avoid modifying the original templates
    const enriched = perspectives.map(perspective => JSON.parse(JSON.stringify(perspective)));
    
    for (const perspective of enriched) {
      // Add intent-specific customizations based on perspective type
      switch (perspective.id) {
        case 'precise-match':
          this.enrichPreciseMatchPerspective(perspective, intent, context);
          break;
          
        case 'enhanced-recall':
          this.enrichEnhancedRecallPerspective(perspective, intent, context);
          break;
          
        case 'statistical-analysis':
          this.enrichStatisticalPerspective(perspective, intent, context);
          break;
          
        case 'time-series':
          this.enrichTimeSeriesPerspective(perspective, intent, context);
          break;
      }
      
      // Add general customizations based on intent
      perspective.intentSummary = this.summarizeIntent(intent);
    }
    
    return enriched;
  }
  
  /**
   * Enrich the Precise Match perspective with intent details
   */
  enrichPreciseMatchPerspective(perspective, intent, context) {
    const { filters, fields } = intent;
    
    // Adjust confidence based on the quality of filters
    if (filters && filters.length > 0) {
      // If we have high confidence filters, boost the perspective confidence
      const highConfidenceFilters = filters.filter(f => f.confidence > 0.7);
      if (highConfidenceFilters.length > 0) {
        perspective.confidence = Math.min(0.95, perspective.confidence + 0.05);
      }
    } else {
      // Without filters, precise match is less useful
      perspective.confidence -= 0.1;
    }
    
    // Add query strategy details
    perspective.queryStrategies = [
      "Use term-level queries for exact field matches",
      "Apply strict filters with no fuzzy matching"
    ];
    
    // If we have specific fields identified, add them to the strategy
    if (fields && fields.length > 0) {
      perspective.queryStrategies.push(
        `Focus on specific fields: ${fields.map(f => f.name).join(', ')}`
      );
    }
    
    // Add schema-specific information if available
    if (context.schema) {
      // Check for keyword fields which are good for precise matching
      const keywordFields = [];
      if (context.schema.analysis && context.schema.analysis.aggregatableFields) {
        keywordFields.push(...context.schema.analysis.aggregatableFields);
      }
      
      if (keywordFields.length > 0) {
        perspective.queryStrategies.push(
          `Use keyword fields for exact matching: ${keywordFields.slice(0, 3).join(', ')}${keywordFields.length > 3 ? '...' : ''}`
        );
      }
    }
  }
  
  /**
   * Enrich the Enhanced Recall perspective with intent details
   */
  enrichEnhancedRecallPerspective(perspective, intent, context) {
    const { filters, fields } = intent;
    
    // Identify if this is primarily a text search
    const isTextSearch = filters.some(f => f.operator === 'contains');
    if (isTextSearch) {
      perspective.confidence = Math.min(0.95, perspective.confidence + 0.05);
    }
    
    // Add query strategy details
    perspective.queryStrategies = [
      "Use match queries for text fields with stemming and analysis",
      "Apply slight fuzziness to accommodate typos",
      "Consider synonyms and related terms"
    ];
    
    // Add schema-specific information if available
    if (context.schema) {
      // Check for text fields which are good for full-text search
      const textFields = [];
      if (context.schema.analysis && context.schema.analysis.searchableFields) {
        textFields.push(...context.schema.analysis.searchableFields);
      }
      
      if (textFields.length > 0) {
        perspective.queryStrategies.push(
          `Focus on analyzed text fields: ${textFields.slice(0, 3).join(', ')}${textFields.length > 3 ? '...' : ''}`
        );
      }
    }
    
    // If we have specific fields identified, incorporate them
    if (fields && fields.length > 0) {
      perspective.queryStrategies.push(
        `Include relevant fields in multi_match: ${fields.map(f => f.name).join(', ')}`
      );
    }
  }
  
  /**
   * Enrich the Statistical Analysis perspective with intent details
   */
  enrichStatisticalPerspective(perspective, intent, context) {
    const { aggregations, filters, entities } = intent;
    
    // If we have explicit aggregations, this perspective is more confident
    if (aggregations && aggregations.length > 0) {
      perspective.confidence = Math.min(0.95, perspective.confidence + 0.05);
      
      // Add the specific aggregation types to the description
      const aggTypes = [...new Set(aggregations.map(a => a.type))];
      perspective.description += ` Using ${aggTypes.join(', ')} aggregations.`;
    } else {
      // Without explicit aggregations, suggest some based on the intent
      perspective.confidence -= 0.05;
    }
    
    // Add query strategy details
    perspective.queryStrategies = [
      "Use bucket aggregations to group data",
      "Apply metric aggregations for numerical analysis"
    ];
    
    // If we have entities, suggest grouping by them
    if (entities && entities.length > 0) {
      perspective.queryStrategies.push(
        `Group results by entity type: ${entities.map(e => e.type).join(', ')}`
      );
    }
    
    // Add filter context
    if (filters && filters.length > 0) {
      perspective.queryStrategies.push(
        "Apply filters before aggregating to focus on relevant data subset"
      );
    }
    
    // Add schema-specific information if available
    if (context.schema && context.schema.analysis) {
      // Suggest good fields for aggregations
      const aggFields = context.schema.analysis.aggregatableFields || [];
      if (aggFields.length > 0) {
        perspective.queryStrategies.push(
          `Recommended aggregation fields: ${aggFields.slice(0, 3).join(', ')}${aggFields.length > 3 ? '...' : ''}`
        );
      }
    }
  }
  
  /**
   * Enrich the Time Series perspective with intent details
   */
  enrichTimeSeriesPerspective(perspective, intent, context) {
    const { timeframe, aggregations } = intent;
    
    // If we have an explicit timeframe, this is a strong time series candidate
    if (timeframe) {
      perspective.confidence = Math.min(0.95, perspective.confidence + 0.05);
      
      if (timeframe.field) {
        perspective.description += ` Using ${timeframe.field} as the time field.`;
      }
      
      // Add interval information if available
      if (timeframe.type === 'relative') {
        perspective.description += ` Analyzing data from the last ${timeframe.value} ${timeframe.unit}(s).`;
      } else if (timeframe.type === 'absolute') {
        perspective.description += ` Analyzing data from ${timeframe.start}${timeframe.end ? ' to ' + timeframe.end : ''}.`;
      }
    } else {
      // Without a timeframe, time series is less confident
      perspective.confidence -= 0.1;
    }
    
    // Add query strategy details
    perspective.queryStrategies = [
      "Use date_histogram aggregation for time bucketing",
      "Apply metric aggregations within each time bucket"
    ];
    
    // Set interval based on timeframe if available
    if (timeframe && timeframe.type === 'relative') {
      // Select appropriate interval based on the timeframe
      let interval;
      const { unit, value } = timeframe;
      
      if (unit === 'minute' || (unit === 'hour' && value <= 6)) {
        interval = 'minute';
      } else if (unit === 'hour' || (unit === 'day' && value <= 3)) {
        interval = 'hour';
      } else if (unit === 'day' || (unit === 'week' && value <= 2)) {
        interval = 'day';
      } else if (unit === 'week' || (unit === 'month' && value <= 3)) {
        interval = 'week';
      } else {
        interval = 'month';
      }
      
      perspective.queryStrategies.push(`Use ${interval} as the histogram interval`);
    } else {
      perspective.queryStrategies.push("Auto-select appropriate interval based on date range");
    }
    
    // Add metric aggregations based on intent
    if (aggregations && aggregations.length > 0) {
      const metricAggs = aggregations.filter(a => 
        ['avg', 'sum', 'min', 'max', 'stats'].includes(a.type)
      );
      
      if (metricAggs.length > 0) {
        const metrics = metricAggs.map(a => `${a.type}(${a.field})`);
        perspective.queryStrategies.push(`Include metrics: ${metrics.join(', ')}`);
      }
    }
    
    // Add schema-specific suggestions
    if (context.schema && context.schema.analysis) {
      const dateFields = context.schema.analysis.dateFields || [];
      if (dateFields.length > 0 && !timeframe?.field) {
        perspective.queryStrategies.push(
          `Recommended date fields: ${dateFields.join(', ')}`
        );
      }
    }
  }
  
  /**
   * Create a summary of the intent for use in perspectives
   */
  summarizeIntent(intent) {
    const { queryType, originalText, entities, filters, aggregations, timeframe, limit } = intent;
    
    let summary = `A ${queryType} query for `;
    
    // Add entity information
    if (entities && entities.length > 0) {
      summary += entities.map(e => e.type).join(', ');
    } else {
      summary += 'data';
    }
    
    // Add filter information
    if (filters && filters.length > 0) {
      summary += ' with filters on ' + filters.map(f => f.field).join(', ');
    }
    
    // Add aggregation information
    if (aggregations && aggregations.length > 0) {
      summary += ' using ' + aggregations.map(a => a.type).join(', ') + ' aggregations';
    }
    
    // Add timeframe information
    if (timeframe) {
      if (timeframe.type === 'relative') {
        summary += ` over the last ${timeframe.value} ${timeframe.unit}(s)`;
      } else if (timeframe.type === 'absolute') {
        summary += ` from ${timeframe.start}${timeframe.end ? ' to ' + timeframe.end : ''}`;
      }
    }
    
    // Add limit information
    if (limit) {
      summary += ` with a limit of ${limit} results`;
    }
    
    return summary;
  }
}

export default PerspectiveGenerationTool;
