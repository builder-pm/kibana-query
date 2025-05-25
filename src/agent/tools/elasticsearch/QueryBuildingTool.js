// src/agent/tools/elasticsearch/QueryBuildingTool.js

/**
 * QueryBuildingTool
 * 
 * Constructs Elasticsearch DSL queries from the intent and perspective.
 * Translates natural language intent and selected query perspectives
 * into concrete, executable Elasticsearch queries.
 */
class QueryBuildingTool {
  constructor() {
    this.name = 'buildQuery';
    this.description = 'Builds Elasticsearch DSL queries from intent and perspective';
  }

  /**
   * Execute the query building process
   * 
   * @param {Object} params - The parameters for query building
   * @param {Object} params.intent - The parsed intent from IntentParsingTool
   * @param {Object} params.perspective - The selected perspective to use for building
   * @param {Object} params.context - Context information including schema
   * @returns {Promise<Object>} - The generated query with explanation
   */
  async execute(params) {
    const { intent, perspective, context = {} } = params;
    
    if (!intent) {
      throw new Error('No intent provided for query building');
    }
    
    if (!perspective) {
      throw new Error('No perspective provided for query building');
    }
    
    try {
      // Select the query builder based on the perspective type
      let query = {};
      
      switch (perspective.id) {
        case 'precise-match':
          query = this.buildPreciseMatchQuery(intent, context);
          break;
          
        case 'enhanced-recall':
          query = this.buildEnhancedRecallQuery(intent, context);
          break;
          
        case 'statistical-analysis':
          query = this.buildStatisticalAnalysisQuery(intent, context);
          break;
          
        case 'time-series':
          query = this.buildTimeSeriesQuery(intent, context);
          break;
          
        default:
          // Default to precise match if the perspective isn't recognized
          query = this.buildPreciseMatchQuery(intent, context);
      }
      
      // Add common query elements
      query = this.addCommonElements(query, intent, context);
      
      // Generate explanation
      const explanation = this.generateQueryExplanation(query, intent, perspective);
      
      return {
        query,
        explanation
      };
    } catch (error) {
      console.error('Error building query:', error);
      throw new Error(`Failed to build query: ${error.message}`);
    }
  }
  
  /**
   * Build a query using the Precise Match perspective
   */
  buildPreciseMatchQuery(intent, context) {
    const { filters, fields, entities, limit, timeframe } = intent;
    
    // Start with an empty query
    let query = {
      size: limit || 10,
      query: {
        bool: {
          must: [],
          filter: [],
          should: [],
          must_not: []
        }
      }
    };
    
    // Add filters
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        this.addFilterToQuery(query, filter, 'precise');
      }
    }
    
    // Add entity-based filters if no specific filters
    if (entities && entities.length > 0 && (!filters || filters.length === 0)) {
      for (const entity of entities) {
        if (entity.type && entity.type !== 'log' && entity.type !== 'document') {
          // Add a term query for the entity type if it's likely a field
          query.query.bool.must.push({
            exists: { field: entity.type }
          });
        }
      }
    }
    
    // Add timeframe filter if present
    if (timeframe) {
      this.addTimeframeFilter(query, timeframe);
    }
    
    // Set fields to return (_source)
    if (fields && fields.length > 0) {
      query._source = fields.map(field => field.name);
    }
    
    return query;
  }
  
  /**
   * Build a query using the Enhanced Recall perspective
   */
  buildEnhancedRecallQuery(intent, context) {
    const { filters, fields, entities, limit, timeframe, originalText } = intent;
    
    // Start with an empty query
    let query = {
      size: limit || 20, // Higher default limit for enhanced recall
      query: {
        bool: {
          must: [],
          filter: [],
          should: [],
          must_not: []
        }
      }
    };
    
    // Look for text search filters and convert them to full-text search
    const textSearchFilters = filters ? filters.filter(f => f.operator === 'contains') : [];
    const otherFilters = filters ? filters.filter(f => f.operator !== 'contains') : [];
    
    // Add full-text search queries
    if (textSearchFilters.length > 0) {
      // If we have specific field text searches
      for (const filter of textSearchFilters) {
        if (filter.field && filter.field !== '_all') {
          query.query.bool.must.push({
            match: {
              [filter.field]: {
                query: filter.value,
                fuzziness: 'AUTO',
                operator: 'OR'
              }
            }
          });
        } else {
          // Search across all fields
          const searchableFields = this.getSearchableFields(context);
          query.query.bool.must.push({
            multi_match: {
              query: filter.value,
              fields: searchableFields,
              type: 'best_fields',
              fuzziness: 'AUTO',
              operator: 'OR'
            }
          });
        }
      }
    } else if (originalText) {
      // If no explicit text search filters but we have original text,
      // extract key terms for a general search
      const keyTerms = this.extractKeyTermsFromText(originalText);
      if (keyTerms && keyTerms.length > 0) {
        const searchableFields = this.getSearchableFields(context);
        
        query.query.bool.should.push({
          multi_match: {
            query: keyTerms.join(' '),
            fields: searchableFields,
            type: 'best_fields',
            fuzziness: 'AUTO',
            operator: 'OR'
          }
        });
        
        // Set minimum_should_match only if we have should clauses and no must clauses
        if (query.query.bool.should.length > 0 && query.query.bool.must.length === 0) {
          query.query.bool.minimum_should_match = 1;
        }
      }
    }
    
    // Add other filters
    for (const filter of otherFilters) {
      this.addFilterToQuery(query, filter, 'enhanced');
    }
    
    // Add timeframe filter if present
    if (timeframe) {
      this.addTimeframeFilter(query, timeframe);
    }
    
    // Set fields to return (_source)
    if (fields && fields.length > 0) {
      query._source = fields.map(field => field.name);
    }
    
    return query;
  }
  
  /**
   * Build a query using the Statistical Analysis perspective
   */
  buildStatisticalAnalysisQuery(intent, context) {
    const { filters, aggregations, limit, timeframe } = intent;
    
    // Start with a query focused on aggregations
    let query = {
      size: 0, // Default to 0 for aggregation-focused queries
      query: {
        bool: {
          must: [],
          filter: [],
          should: [],
          must_not: []
        }
      },
      aggs: {}
    };
    
    // Add filters
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        this.addFilterToQuery(query, filter, 'precise');
      }
    }
    
    // Add timeframe filter if present
    if (timeframe) {
      this.addTimeframeFilter(query, timeframe);
    }
    
    // Add aggregations
    if (aggregations && aggregations.length > 0) {
      for (const agg of aggregations) {
        this.addAggregationToQuery(query, agg, context);
      }
    } else {
      // If no explicit aggregations, try to create a default one based on context
      this.addDefaultAggregations(query, intent, context);
    }
    
    // If we need to include top hits with the aggregations
    if (limit && limit > 0) {
      query.size = Math.min(limit, 10); // Limit the top results
    }
    
    return query;
  }
  
  /**
   * Build a query using the Time Series perspective
   */
  buildTimeSeriesQuery(intent, context) {
    const { filters, aggregations, timeframe, limit } = intent;
    
    // Start with a query focused on time-based aggregations
    let query = {
      size: 0, // Default to 0 for aggregation-focused queries
      query: {
        bool: {
          must: [],
          filter: [],
          should: [],
          must_not: []
        }
      },
      aggs: {}
    };
    
    // Add filters
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        this.addFilterToQuery(query, filter, 'precise');
      }
    }
    
    // Add timeframe filter if present
    if (timeframe) {
      this.addTimeframeFilter(query, timeframe);
    } else {
      // Default timeframe if not specified (last 24 hours)
      this.addTimeframeFilter(query, {
        type: 'relative',
        unit: 'hour',
        value: 24,
        field: '@timestamp'
      });
    }
    
    // Get the time field from timeframe or default
    const timeField = timeframe ? timeframe.field : '@timestamp';
    
    // Extract interval from timeframe or set a default
    const interval = this.determineTimeInterval(timeframe);
    
    // Add date histogram aggregation
    query.aggs.time_buckets = {
      date_histogram: {
        field: timeField,
        calendar_interval: interval,
        min_doc_count: 0,
        extended_bounds: this.getExtendedBounds(timeframe)
      }
    };
    
    // Add sub-aggregations
    if (aggregations && aggregations.length > 0) {
      const metricAggs = aggregations.filter(agg => 
        ['avg', 'sum', 'min', 'max', 'stats'].includes(agg.type)
      );
      
      if (metricAggs.length > 0) {
        for (const agg of metricAggs) {
          query.aggs.time_buckets.aggs = query.aggs.time_buckets.aggs || {};
          query.aggs.time_buckets.aggs[`${agg.type}_${agg.field}`] = {
            [agg.type]: { field: agg.field }
          };
        }
      } else {
        // If no metric aggregations, add a count
        query.aggs.time_buckets.aggs = {
          doc_count: { value_count: { field: '_index' } }
        };
      }
      
      // If there are terms aggregations, add as a secondary dimension
      const termsAggs = aggregations.filter(agg => agg.type === 'terms');
      if (termsAggs.length > 0) {
        const termsAgg = termsAggs[0]; // Use the first terms aggregation
        query.aggs.time_buckets.aggs.by_term = {
          terms: {
            field: termsAgg.field,
            size: termsAgg.size || 10
          }
        };
      }
    } else {
      // Default to document count if no specific aggregations
      query.aggs.time_buckets.aggs = {
        doc_count: { value_count: { field: '_index' } }
      };
    }
    
    return query;
  }
  
  /**
   * Add common elements to the query regardless of perspective
   */
  addCommonElements(query, intent, context) {
    const { sorting, limit } = intent;
    
    // Add sorting if specified
    if (sorting && sorting.length > 0) {
      query.sort = sorting.map(sort => ({
        [sort.field]: { order: sort.order || 'desc' }
      }));
    }
    
    // Set size if not already set and limit is specified
    if (limit !== null && limit !== undefined && !query.size) {
      query.size = limit;
    }
    
    // Track total hits
    query.track_total_hits = true;
    
    return query;
  }
  
  /**
   * Add a filter to the query based on the filter specification
   */
  addFilterToQuery(query, filter, mode = 'precise') {
    const { field, operator, value } = filter;
    
    if (!field) return;
    
    switch (operator) {
      case 'eq':
        if (mode === 'precise') {
          // For precise match, use term query
          query.query.bool.filter.push({
            term: { [field]: value }
          });
        } else {
          // For enhanced recall, use match query
          query.query.bool.must.push({
            match: { [field]: value }
          });
        }
        break;
        
      case 'gt':
        query.query.bool.filter.push({
          range: { [field]: { gt: value } }
        });
        break;
        
      case 'gte':
        query.query.bool.filter.push({
          range: { [field]: { gte: value } }
        });
        break;
        
      case 'lt':
        query.query.bool.filter.push({
          range: { [field]: { lt: value } }
        });
        break;
        
      case 'lte':
        query.query.bool.filter.push({
          range: { [field]: { lte: value } }
        });
        break;
        
      case 'contains':
        if (mode === 'precise') {
          // In precise mode, use wildcard
          query.query.bool.filter.push({
            wildcard: { [field]: `*${value}*` }
          });
        } else {
          // Already handled in the main method for enhanced recall
          // But add as a fallback for fields not handled there
          if (field !== '_all') {
            query.query.bool.should.push({
              match: { 
                [field]: {
                  query: value,
                  fuzziness: 'AUTO'
                }
              }
            });
            
            // If no must clauses, set minimum_should_match
            if (query.query.bool.must.length === 0) {
              query.query.bool.minimum_should_match = 1;
            }
          }
        }
        break;
        
      case 'exists':
        query.query.bool.filter.push({
          exists: { field }
        });
        break;
        
      case 'missing':
        query.query.bool.must_not.push({
          exists: { field }
        });
        break;
    }
  }
  
  /**
   * Add a timeframe filter to the query
   */
  addTimeframeFilter(query, timeframe) {
    if (!timeframe || !timeframe.field) return;
    
    const field = timeframe.field;
    
    switch (timeframe.type) {
      case 'relative':
        // Calculate relative time range
        let amount = timeframe.value;
        let unit = timeframe.unit;
        
        // Convert to proper Elasticsearch date math syntax
        let dateValue = `now-${amount}${unit.charAt(0)}`;
        
        query.query.bool.filter.push({
          range: {
            [field]: {
              gte: dateValue,
              lte: 'now'
            }
          }
        });
        break;
        
      case 'absolute':
        // Set absolute time range
        let rangeFilter = {
          range: {
            [field]: {}
          }
        };
        
        if (timeframe.start) {
          rangeFilter.range[field].gte = timeframe.start;
        }
        
        if (timeframe.end) {
          rangeFilter.range[field].lte = timeframe.end;
        }
        
        query.query.bool.filter.push(rangeFilter);
        break;
        
      case 'named':
        // Convert named ranges to explicit ranges
        switch (timeframe.period) {
          case 'today':
            query.query.bool.filter.push({
              range: {
                [field]: {
                  gte: 'now/d',
                  lte: 'now'
                }
              }
            });
            break;
            
          case 'yesterday':
            query.query.bool.filter.push({
              range: {
                [field]: {
                  gte: 'now-1d/d',
                  lt: 'now/d'
                }
              }
            });
            break;
            
          case 'this week':
            query.query.bool.filter.push({
              range: {
                [field]: {
                  gte: 'now/w',
                  lte: 'now'
                }
              }
            });
            break;
            
          case 'this month':
            query.query.bool.filter.push({
              range: {
                [field]: {
                  gte: 'now/M',
                  lte: 'now'
                }
              }
            });
            break;
        }
        break;
    }
  }
  
  /**
   * Add aggregation to query based on aggregation specification
   */
  addAggregationToQuery(query, aggregation, context) {
    const { type, field, size, interval } = aggregation;
    
    if (!field) return;
    
    // Create a safe aggregation name
    const aggName = `${type}_${field.replace('.', '_')}`;
    
    switch (type) {
      case 'terms':
        query.aggs[aggName] = {
          terms: {
            field: field,
            size: size || 10
          }
        };
        break;
        
      case 'date_histogram':
      case 'histogram':
        const isDate = type === 'date_histogram';
        const intervalKey = isDate ? 'calendar_interval' : 'interval';
        const intervalValue = interval || (isDate ? 'day' : 10);
        
        query.aggs[aggName] = {
          [type]: {
            field: field,
            [intervalKey]: intervalValue,
            min_doc_count: 0
          }
        };
        break;
        
      case 'range':
        query.aggs[aggName] = {
          range: {
            field: field,
            ranges: [
              { to: 10 },
              { from: 10, to: 20 },
              { from: 20 }
            ]
          }
        };
        break;
        
      case 'date_range':
        query.aggs[aggName] = {
          date_range: {
            field: field,
            ranges: [
              { to: 'now-1d' },
              { from: 'now-1d', to: 'now' },
              { from: 'now' }
            ]
          }
        };
        break;
        
      // Metric aggregations
      case 'avg':
      case 'sum':
      case 'min':
      case 'max':
      case 'stats':
      case 'extended_stats':
      case 'percentiles':
      case 'cardinality':
        query.aggs[aggName] = {
          [type]: {
            field: field
          }
        };
        break;
    }
  }
  
  /**
   * Add default aggregations based on intent when none are explicitly specified
   */
  addDefaultAggregations(query, intent, context) {
    const { entities, filters } = intent;
    let fieldForAggregation = null;
    
    // Try to find a suitable field for aggregation
    if (filters && filters.length > 0) {
      // Use a field from filters that isn't being filtered by equals
      for (const filter of filters) {
        if (filter.field && filter.operator !== 'eq' && filter.operator !== 'contains') {
          fieldForAggregation = filter.field;
          break;
        }
      }
      
      // If no field found, use the first filter field
      if (!fieldForAggregation && filters[0].field) {
        fieldForAggregation = filters[0].field;
      }
    }
    
    // If no field from filters, try entities
    if (!fieldForAggregation && entities && entities.length > 0) {
      fieldForAggregation = entities[0].type;
    }
    
    // If still no field, use schema info
    if (!fieldForAggregation && context.schema && context.schema.analysis) {
      if (context.schema.analysis.aggregatableFields && context.schema.analysis.aggregatableFields.length > 0) {
        fieldForAggregation = context.schema.analysis.aggregatableFields[0];
      }
    }
    
    // Add a terms aggregation if we found a suitable field
    if (fieldForAggregation) {
      query.aggs[`terms_${fieldForAggregation.replace('.', '_')}`] = {
        terms: {
          field: fieldForAggregation,
          size: 10
        }
      };
    } else {
      // Fallback to a simple count
      query.aggs.doc_count = {
        value_count: {
          field: '_index'
        }
      };
    }
  }
  
  /**
   * Determine an appropriate time interval based on the timeframe
   */
  determineTimeInterval(timeframe) {
    if (!timeframe) return 'day';
    
    if (timeframe.type === 'relative') {
      const { unit, value } = timeframe;
      
      // Choose interval based on the time range
      if (unit === 'minute' || (unit === 'hour' && value <= 6)) {
        return 'minute';
      } else if (unit === 'hour' || (unit === 'day' && value <= 3)) {
        return 'hour';
      } else if (unit === 'day' || (unit === 'week' && value <= 2)) {
        return 'day';
      } else if (unit === 'week' || (unit === 'month' && value <= 3)) {
        return 'week';
      } else {
        return 'month';
      }
    }
    
    // Default interval
    return 'day';
  }
  
  /**
   * Get extended bounds for date histograms
   */
  getExtendedBounds(timeframe) {
    if (!timeframe) return null;
    
    if (timeframe.type === 'relative') {
      return null; // Let ES determine bounds automatically
    } else if (timeframe.type === 'absolute') {
      // If we have explicit start and end dates
      if (timeframe.start && timeframe.end) {
        return {
          min: timeframe.start,
          max: timeframe.end
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get a list of searchable fields from schema context
   */
  getSearchableFields(context) {
    // Default fields to search across if no schema available
    const defaultFields = ['*'];
    
    if (!context.schema || !context.schema.analysis) {
      return defaultFields;
    }
    
    const schemaAnalysis = context.schema.analysis;
    
    if (schemaAnalysis.searchableFields && schemaAnalysis.searchableFields.length > 0) {
      return schemaAnalysis.searchableFields;
    }
    
    return defaultFields;
  }
  
  /**
   * Extract key terms from the original query text for enhanced recall
   */
  extractKeyTermsFromText(text) {
    if (!text) return [];
    
    const stopwords = [
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'as', 'of', 'to', 'in', 'for',
      'on', 'by', 'at', 'with', 'about', 'from', 'me', 'show', 'tell', 'give',
      'find', 'search', 'get', 'list', 'query', 'return'
    ];
    
    // Tokenize, convert to lowercase, remove stopwords, and filter out short terms
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopwords.includes(term));
  }
  
  /**
   * Generate a human-readable explanation of the query
   */
  generateQueryExplanation(query, intent, perspective) {
    let explanation = `This query uses the ${perspective.name} approach to `;
    
    // Describe the primary purpose of the query
    if (query.aggs && Object.keys(query.aggs).length > 0) {
      explanation += 'analyze data';
      
      // Add details about the aggregations
      const aggTypes = [];
      for (const [aggName, aggValue] of Object.entries(query.aggs)) {
        const aggType = Object.keys(aggValue)[0];
        if (aggType === 'terms') {
          aggTypes.push(`grouping by ${aggValue.terms.field}`);
        } else if (aggType === 'date_histogram') {
          const interval = aggValue.date_histogram.calendar_interval;
          aggTypes.push(`breaking time into ${interval} intervals`);
        } else if (['avg', 'sum', 'min', 'max', 'stats'].includes(aggType)) {
          const field = aggValue[aggType].field;
          aggTypes.push(`calculating ${aggType} of ${field}`);
        }
      }
      
      if (aggTypes.length > 0) {
        explanation += ` by ${aggTypes.join(' and ')}`;
      }
    } else {
      explanation += 'search for matching documents';
    }
    
    // Describe filters
    if (query.query && query.query.bool) {
      const filterCount = (query.query.bool.filter || []).length;
      const mustCount = (query.query.bool.must || []).length;
      const mustNotCount = (query.query.bool.must_not || []).length;
      const shouldCount = (query.query.bool.should || []).length;
      
      if (filterCount + mustCount + mustNotCount + shouldCount > 0) {
        explanation += ' with criteria including';
        
        const conditions = [];
        
        if (filterCount > 0) {
          conditions.push(`${filterCount} filter${filterCount !== 1 ? 's' : ''}`);
        }
        
        if (mustCount > 0) {
          conditions.push(`${mustCount} required match${mustCount !== 1 ? 'es' : ''}`);
        }
        
        if (mustNotCount > 0) {
          conditions.push(`${mustNotCount} exclusion${mustNotCount !== 1 ? 's' : ''}`);
        }
        
        if (shouldCount > 0) {
          conditions.push(`${shouldCount} optional match${shouldCount !== 1 ? 'es' : ''}`);
        }
        
        explanation += ` ${conditions.join(', ')}`;
      }
    }
    
    // Add sorting information
    if (query.sort && query.sort.length > 0) {
      const sortFields = query.sort.map(sortItem => {
        const field = Object.keys(sortItem)[0];
        const order = sortItem[field].order;
        return `${field} (${order})`;
      });
      
      explanation += ` sorted by ${sortFields.join(', ')}`;
    }
    
    // Add result size
    if (query.size !== undefined) {
      explanation += `, returning ${query.size === 0 ? 'only aggregation results' : `up to ${query.size} documents`}`;
    }
    
    return explanation;
  }
}

export default QueryBuildingTool;