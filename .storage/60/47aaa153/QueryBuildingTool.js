// src/agent/tools/elasticsearch/QueryBuildingTool.js

/**
 * QueryBuildingTool
 * 
 * This tool constructs an Elasticsearch DSL query based on intent and perspective.
 * It translates natural language intent into the structured query format
 * that Elasticsearch understands, following the approach defined by the perspective.
 */
class QueryBuildingTool {
  constructor() {
    this.name = 'buildQuery';
    this.description = 'Constructs Elasticsearch DSL from intent and perspective';
  }

  /**
   * Executes the query building process based on intent and perspective
   * 
   * @param {Object} params - Parameters for query building
   * @param {Object} params.intent - The parsed intent from IntentParsingTool
   * @param {Object} params.perspective - The selected perspective/approach
   * @param {Object} params.context - Context information (schema, cluster info, etc.)
   * @returns {Object} - Elasticsearch DSL query
   */
  async execute(params) {
    const { intent, perspective, context } = params;
    
    if (!intent || !perspective) {
      throw new Error('Invalid parameters: intent and perspective are required');
    }

    // Extract query type from intent
    const queryType = intent.queryType || 'search';
    
    // Build different query types based on intent
    let query;
    switch (queryType) {
      case 'search':
        query = this.buildSearchQuery(intent, perspective, context);
        break;
      case 'aggregation':
        query = this.buildAggregationQuery(intent, perspective, context);
        break;
      case 'analytics':
        query = this.buildAnalyticsQuery(intent, perspective, context);
        break;
      default:
        query = this.buildSearchQuery(intent, perspective, context);
    }
    
    // Add common query elements
    query = this.addCommonElements(query, intent, perspective, context);
    
    return query;
  }

  /**
   * Build a search-oriented query
   */
  buildSearchQuery(intent, perspective, context) {
    const { entities = {} } = intent;
    const { queryParams = {} } = perspective;
    const { schema = {} } = context;
    
    const query = {
      size: 20, // Default size
      query: {}
    };

    const searchFields = this.getSearchableFields(entities, schema);
    const filterFields = this.getFilterFields(entities, schema);
    
    // Build the base query structure
    if (queryParams.strictMode) {
      // For precise match perspective: use bool query with must clauses
      const mustClauses = [];
      const shouldClauses = [];
      
      // Process search fields (full-text search)
      for (const [field, value] of Object.entries(searchFields)) {
        if (queryParams.useMultiMatch && searchFields.length > 1) {
          // Use multi_match for multiple fields
          mustClauses.push({
            multi_match: {
              query: value,
              fields: [field],
              type: queryParams.multiMatchType || 'best_fields',
              tie_breaker: queryParams.tieBreaker || 0.3,
              minimum_should_match: queryParams.minimumShouldMatch || '100%'
            }
          });
        } else {
          // Use match for single field
          mustClauses.push({
            match: {
              [field]: {
                query: value,
                operator: 'AND'
              }
            }
          });
        }
      }
      
      // Process filter fields (exact matches)
      for (const [field, value] of Object.entries(filterFields)) {
        if (typeof value === 'object' && (value.gte !== undefined || value.lte !== undefined)) {
          // Range query
          mustClauses.push({
            range: {
              [field]: value
            }
          });
        } else if (Array.isArray(value)) {
          // Terms query for arrays
          mustClauses.push({
            terms: {
              [field]: value
            }
          });
        } else {
          // Term query for exact matches
          mustClauses.push({
            term: {
              [field]: value
            }
          });
        }
      }
      
      query.query = {
        bool: {
          must: mustClauses,
          should: shouldClauses
        }
      };
      
    } else {
      // For enhanced recall or relevance perspective: use more lenient matching
      const mustClauses = [];
      const shouldClauses = [];
      const filterClauses = [];
      
      // Process search fields with more relaxed matching
      for (const [field, value] of Object.entries(searchFields)) {
        if (queryParams.useMultiMatch && Object.keys(searchFields).length > 1) {
          // Multi-match query for multiple fields
          shouldClauses.push({
            multi_match: {
              query: value,
              fields: [`${field}^2`, `${field}._2gram`, `${field}._3gram`],
              type: queryParams.multiMatchType || 'best_fields',
              tie_breaker: queryParams.tieBreaker || 0.3,
              fuzziness: queryParams.fuzzy ? 'AUTO' : 0
            }
          });
        } else {
          // Match query with fuzziness
          shouldClauses.push({
            match: {
              [field]: {
                query: value,
                fuzziness: queryParams.fuzzy ? 'AUTO' : 0,
                minimum_should_match: queryParams.minimumShouldMatch || '75%'
              }
            }
          });
          
          // Add exact match with higher boost for relevant matches
          if (queryParams.boostExactMatches) {
            shouldClauses.push({
              match_phrase: {
                [field]: {
                  query: value,
                  boost: 2.0
                }
              }
            });
          }
        }
      }
      
      // Process filter fields
      for (const [field, value] of Object.entries(filterFields)) {
        if (typeof value === 'object' && (value.gte !== undefined || value.lte !== undefined)) {
          // Range query
          filterClauses.push({
            range: {
              [field]: value
            }
          });
        } else if (Array.isArray(value)) {
          // Terms query for arrays
          filterClauses.push({
            terms: {
              [field]: value
            }
          });
        } else {
          // Term query for exact matches
          filterClauses.push({
            term: {
              [field]: value
            }
          });
        }
      }
      
      query.query = {
        bool: {
          should: shouldClauses,
          filter: filterClauses,
          minimum_should_match: shouldClauses.length > 0 ? 1 : 0
        }
      };
      
      // For relevance-optimized, add function score for better ranking
      if (perspective.id === 'relevance-optimized') {
        query.query = {
          function_score: {
            query: query.query,
            functions: [
              {
                field_value_factor: {
                  field: '_score',
                  factor: 1.2,
                  modifier: 'ln2p'
                }
              }
            ],
            boost_mode: 'multiply'
          }
        };
      }
    }
    
    // Add aggregations if requested by perspective
    if (queryParams.includeAggregations && queryParams.aggregationFields) {
      query.aggs = {};
      for (const field of queryParams.aggregationFields) {
        // Only add aggregation if field exists
        if (field) {
          query.aggs[`by_${field}`] = this.getAppropriateAggregation(field, schema);
        }
      }
    }
    
    // Set pagination if specified
    if (queryParams.size !== undefined) {
      query.size = queryParams.size;
    }
    
    return query;
  }

  /**
   * Build an aggregation-oriented query
   */
  buildAggregationQuery(intent, perspective, context) {
    const { entities = {} } = intent;
    const { queryParams = {} } = perspective;
    const { schema = {} } = context;
    
    const query = {
      size: queryParams.size || 0, // Default to 0 for pure aggregation queries
      aggs: {}
    };
    
    // Add query part if there are filtering conditions
    const filterFields = this.getFilterFields(entities, schema);
    if (Object.keys(filterFields).length > 0) {
      const filterClauses = [];
      
      for (const [field, value] of Object.entries(filterFields)) {
        if (typeof value === 'object' && (value.gte !== undefined || value.lte !== undefined)) {
          // Range query
          filterClauses.push({
            range: {
              [field]: value
            }
          });
        } else if (Array.isArray(value)) {
          // Terms query for arrays
          filterClauses.push({
            terms: {
              [field]: value
            }
          });
        } else {
          // Term query for exact matches
          filterClauses.push({
            term: {
              [field]: value
            }
          });
        }
      }
      
      if (filterClauses.length > 0) {
        query.query = {
          bool: {
            filter: filterClauses
          }
        };
      }
    }
    
    // Build aggregations based on perspective type
    switch (queryParams.aggregationType) {
      case 'time-series':
        query.aggs = this.buildTimeSeriesAggregation(intent, perspective, context);
        break;
      
      case 'multi-dimensional':
        query.aggs = this.buildMultiDimensionalAggregation(intent, perspective, context);
        break;
      
      case 'standard':
      default:
        query.aggs = this.buildStandardAggregations(intent, perspective, context);
        break;
    }
    
    return query;
  }

  /**
   * Build an analytics-oriented query
   */
  buildAnalyticsQuery(intent, perspective, context) {
    const { entities = {} } = intent;
    const { queryParams = {} } = perspective;
    const { schema = {} } = context;
    
    const query = {
      size: queryParams.size || 0, // Default to 0 for analytics
      aggs: {}
    };
    
    // Add filters if needed
    const filterFields = this.getFilterFields(entities, schema);
    if (Object.keys(filterFields).length > 0) {
      const filterClauses = [];
      
      for (const [field, value] of Object.entries(filterFields)) {
        if (typeof value === 'object' && (value.gte !== undefined || value.lte !== undefined)) {
          filterClauses.push({
            range: {
              [field]: value
            }
          });
        } else if (Array.isArray(value)) {
          filterClauses.push({
            terms: {
              [field]: value
            }
          });
        } else {
          filterClauses.push({
            term: {
              [field]: value
            }
          });
        }
      }
      
      if (filterClauses.length > 0) {
        query.query = {
          bool: {
            filter: filterClauses
          }
        };
      }
    }
    
    // Build aggregations based on perspective type
    switch (queryParams.aggregationType) {
      case 'stats':
        query.aggs = this.buildStatisticalAggregations(intent, perspective, context);
        break;
      
      case 'terms':
        query.aggs = this.buildTermsAggregations(intent, perspective, context);
        break;
      
      case 'comparative':
        query.aggs = this.buildComparativeAggregations(intent, perspective, context);
        break;
        
      default:
        query.aggs = this.buildTermsAggregations(intent, perspective, context);
        break;
    }
    
    return query;
  }

  /**
   * Add common elements to all query types
   */
  addCommonElements(query, intent, perspective, context) {
    // Add highlight for search queries if not an aggregation
    if (intent.queryType === 'search' && query.size > 0) {
      query.highlight = {
        fields: {}
      };
      
      // Add highlight fields based on the used fields in the query
      if (query.query && query.query.bool && query.query.bool.must) {
        query.query.bool.must.forEach(clause => {
          if (clause.match) {
            const field = Object.keys(clause.match)[0];
            query.highlight.fields[field] = {};
          } else if (clause.multi_match) {
            clause.multi_match.fields.forEach(field => {
              const cleanField = field.split('^')[0]; // Remove boost if present
              query.highlight.fields[cleanField] = {};
            });
          }
        });
      }
      
      // If no highlight fields were added but we have query.bool.should
      if (query.query && query.query.bool && query.query.bool.should && 
          Object.keys(query.highlight.fields).length === 0) {
        query.query.bool.should.forEach(clause => {
          if (clause.match) {
            const field = Object.keys(clause.match)[0];
            query.highlight.fields[field] = {};
          } else if (clause.match_phrase) {
            const field = Object.keys(clause.match_phrase)[0];
            query.highlight.fields[field] = {};
          } else if (clause.multi_match) {
            clause.multi_match.fields.forEach(field => {
              const cleanField = field.split('^')[0]; // Remove boost if present
              query.highlight.fields[cleanField] = {};
            });
          }
        });
      }
      
      // If no highlight fields were found, remove highlight
      if (Object.keys(query.highlight.fields).length === 0) {
        delete query.highlight;
      }
    }
    
    // Add sort if needed
    if (intent.sort) {
      query.sort = intent.sort;
    }
    
    // Add track_total_hits if available (ES 7.x+)
    query.track_total_hits = true;
    
    // Add explain if requested
    if (perspective.queryParams && perspective.queryParams.includeExplanation) {
      query.explain = true;
    }
    
    return query;
  }

  /**
   * Helper: Separate search fields from filter fields
   */
  getSearchableFields(entities, schema) {
    const searchFields = {};
    
    if (!entities) return searchFields;
    
    // If schema has searchable fields info, use it
    const searchableFieldNames = schema?.analysis?.searchableFields || [];
    
    for (const [field, value] of Object.entries(entities)) {
      // Consider it a search field if:
      // 1. It's a searchable field in the schema, or
      // 2. Value is a string with multiple words (likely for full-text search), or
      // 3. Field name contains 'text', 'title', 'description', 'name', 'content'
      if (
        searchableFieldNames.includes(field) ||
        (typeof value === 'string' && value.split(' ').length > 1) ||
        field.toLowerCase().includes('text') ||
        field.toLowerCase().includes('title') ||
        field.toLowerCase().includes('description') ||
        field.toLowerCase().includes('name') ||
        field.toLowerCase().includes('content')
      ) {
        searchFields[field] = value;
      }
    }
    
    return searchFields;
  }

  /**
   * Helper: Get filter fields (non-searchable)
   */
  getFilterFields(entities, schema) {
    const filterFields = {};
    
    if (!entities) return filterFields;
    
    // If schema has information on aggregatable (keyword) fields, use it
    const aggregatableFieldNames = schema?.analysis?.aggregatableFields || [];
    const searchableFieldNames = schema?.analysis?.searchableFields || [];
    
    for (const [field, value] of Object.entries(entities)) {
      // Consider it a filter field if:
      // 1. It's an aggregatable field in the schema, or
      // 2. It's not a searchable field, or 
      // 3. Value is a number, boolean, or single word, or
      // 4. Value is an object with range operators (gte, lte, etc.)
      if (
        aggregatableFieldNames.includes(field) ||
        !searchableFieldNames.includes(field) ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        (typeof value === 'string' && value.split(' ').length === 1) ||
        (typeof value === 'object' && (value.gte !== undefined || value.lte !== undefined))
      ) {
        filterFields[field] = value;
      }
    }
    
    return filterFields;
  }

  /**
   * Helper: Get appropriate aggregation type for a field
   */
  getAppropriateAggregation(field, schema) {
    // Try to determine field type from schema
    let fieldType = 'unknown';
    
    if (schema && schema.mappings && schema.mappings.properties) {
      const fieldMapping = this.getNestedField(schema.mappings.properties, field);
      if (fieldMapping && fieldMapping.type) {
        fieldType = fieldMapping.type;
      }
    }
    
    // Choose aggregation based on field type
    switch (fieldType) {
      case 'date':
        return {
          date_histogram: {
            field: field,
            calendar_interval: 'day'
          }
        };
      
      case 'long':
      case 'integer':
      case 'double':
      case 'float':
        return {
          stats: {
            field: field
          }
        };
      
      case 'geo_point':
        return {
          geo_distance: {
            field: field,
            origin: '0, 0',
            ranges: [
              { to: 100000 }, // 100km
              { from: 100000, to: 300000 }, // 100km-300km
              { from: 300000 } // 300km+
            ]
          }
        };
      
      case 'keyword':
      default:
        return {
          terms: {
            field: field,
            size: 10
          }
        };
    }
  }

  /**
   * Build standard aggregations
   */
  buildStandardAggregations(intent, perspective, context) {
    const aggregations = {};
    const { entities = {} } = intent;
    const { queryParams = {} } = perspective;
    
    // Get aggregatable fields from entities or schema
    let aggFields = [];
    
    // Use fields from entities that might be for aggregations
    for (const [field, value] of Object.entries(entities)) {
      if (field.toLowerCase().includes('group_by') ||
          field.toLowerCase().includes('aggregate') ||
          field.toLowerCase().includes('agg_by')) {
        aggFields.push(value);
      }
    }
    
    // If no agg fields found, try to get some from schema
    if (aggFields.length === 0 && context.schema && context.schema.analysis) {
      aggFields = context.schema.analysis.aggregatableFields || [];
      // Limit to first 2 for simplicity
      aggFields = aggFields.slice(0, 2);
    }
    
    // Create term aggregations for each field
    for (const field of aggFields) {
      aggregations[`by_${field}`] = {
        terms: {
          field: field,
          size: 10
        }
      };
      
      // Add sub-aggregations if requested
      if (queryParams.includeSubAggregations) {
        // Find numeric fields for sub-aggregations
        const numericFields = this.getNumericFields(context.schema);
        if (numericFields.length > 0) {
          aggregations[`by_${field}`].aggs = {};
          for (const numField of numericFields.slice(0, 2)) { // Limit to 2 sub-aggs
            aggregations[`by_${field}`].aggs[`stats_${numField}`] = {
              stats: {
                field: numField
              }
            };
          }
        }
      }
    }
    
    return aggregations;
  }

  /**
   * Build time series aggregations
   */
  buildTimeSeriesAggregation(intent, perspective, context) {
    const { queryParams = {} } = perspective;
    
    // Find date field in schema
    let dateField = '';
    if (context.schema && context.schema.analysis && context.schema.analysis.dateFields) {
      dateField = context.schema.analysis.dateFields[0]; // Use first date field
    } else {
      // Default to common date field names if schema doesn't specify
      dateField = '@timestamp';
    }
    
    const interval = queryParams.interval || 'day';
    
    const timeAgg = {
      time_buckets: {
        date_histogram: {
          field: dateField,
          calendar_interval: interval,
          format: 'yyyy-MM-dd'
        }
      }
    };
    
    // Add sub-aggregations if requested
    if (queryParams.includeSubAggregations) {
      // Find numeric fields for metrics
      const numericFields = this.getNumericFields(context.schema);
      if (numericFields.length > 0) {
        timeAgg.time_buckets.aggs = {};
        for (const numField of numericFields.slice(0, 3)) { // Limit to 3 metrics
          timeAgg.time_buckets.aggs[`stats_${numField}`] = {
            stats: {
              field: numField
            }
          };
        }
      }
    }
    
    return timeAgg;
  }

  /**
   * Build multi-dimensional aggregations
   */
  buildMultiDimensionalAggregation(intent, perspective, context) {
    const { queryParams = {} } = perspective;
    const dimensions = queryParams.dimensions || [];
    
    if (dimensions.length === 0) {
      // Fall back to standard aggregations if no dimensions
      return this.buildStandardAggregations(intent, perspective, context);
    }
    
    // Take the first dimension as primary
    const primaryDimension = dimensions[0];
    
    const multiAgg = {
      [`by_${primaryDimension}`]: {
        terms: {
          field: primaryDimension,
          size: 10
        }
      }
    };
    
    // Add nested dimensions
    if (dimensions.length > 1) {
      multiAgg[`by_${primaryDimension}`].aggs = {};
      const secondaryDimension = dimensions[1];
      
      multiAgg[`by_${primaryDimension}`].aggs[`by_${secondaryDimension}`] = {
        terms: {
          field: secondaryDimension,
          size: 10
        }
      };
      
      // Add metrics as sub-sub aggregations
      if (queryParams.includeSubAggregations) {
        const numericFields = this.getNumericFields(context.schema);
        if (numericFields.length > 0) {
          multiAgg[`by_${primaryDimension}`].aggs[`by_${secondaryDimension}`].aggs = {};
          for (const numField of numericFields.slice(0, 2)) {
            multiAgg[`by_${primaryDimension}`].aggs[`by_${secondaryDimension}`].aggs[`stats_${numField}`] = {
              stats: {
                field: numField
              }
            };
          }
        }
      }
    }
    
    return multiAgg;
  }

  /**
   * Build statistical aggregations
   */
  buildStatisticalAggregations(intent, perspective, context) {
    const { queryParams = {} } = perspective;
    const aggregations = {};
    
    // Get numeric fields from schema
    const numericFields = this.getNumericFields(context.schema);
    
    if (numericFields.length === 0) {
      // No numeric fields found, return empty aggs
      return aggregations;
    }
    
    // Add statistical aggregations for each numeric field
    for (const field of numericFields) {
      if (queryParams.extendedStats) {
        aggregations[`extended_stats_${field}`] = {
          extended_stats: {
            field: field
          }
        };
      } else {
        aggregations[`stats_${field}`] = {
          stats: {
            field: field
          }
        };
      }
      
      // Add percentiles if requested
      if (queryParams.percentiles) {
        aggregations[`percentiles_${field}`] = {
          percentiles: {
            field: field,
            percents: [1, 5, 25, 50, 75, 95, 99]
          }
        };
      }
    }
    
    return aggregations;
  }

  /**
   * Build terms aggregations
   */
  buildTermsAggregations(intent, perspective, context) {
    const { queryParams = {} } = perspective;
    const aggregations = {};
    
    // Get categorical fields from schema
    const categoricalFields = this.getCategoricalFields(context.schema);
    
    if (categoricalFields.length === 0) {
      // No categorical fields found, return empty aggs
      return aggregations;
    }
    
    // Add term aggregations for each categorical field
    for (const field of categoricalFields) {
      aggregations[`top_${field}`] = {
        terms: {
          field: field,
          size: queryParams.termsSize || 10,
          order: {
            [queryParams.orderBy || '_count']: queryParams.order || 'desc'
          }
        }
      };
      
      // Add sub-aggregations for metrics if we have numeric fields
      const numericFields = this.getNumericFields(context.schema);
      if (numericFields.length > 0) {
        aggregations[`top_${field}`].aggs = {};
        for (const numField of numericFields.slice(0, 2)) { // Limit to 2 metrics
          aggregations[`top_${field}`].aggs[`stats_${numField}`] = {
            stats: {
              field: numField
            }
          };
        }
      }
    }
    
    return aggregations;
  }

  /**
   * Build comparative aggregations
   */
  buildComparativeAggregations(intent, perspective, context) {
    const { queryParams = {} } = perspective;
    const compareBy = queryParams.compareBy || {};
    
    // If no comparison dimension, return empty aggs
    if (!compareBy || !compareBy.dimension) {
      return {};
    }
    
    const dimension = compareBy.dimension;
    const values = compareBy.values || [];
    
    const aggregations = {};
    
    // Use filters aggregation for comparison
    aggregations[`compare_${dimension}`] = {
      filters: {
        filters: {}
      }
    };
    
    // If values are provided, create a bucket for each value
    if (values && values.length > 0) {
      values.forEach(value => {
        aggregations[`compare_${dimension}`].filters.filters[`${value}`] = {
          term: {
            [dimension]: value
          }
        };
      });
    } else {
      // Default comparison buckets
      aggregations[`compare_${dimension}`].filters.filters.A = {
        term: {
          [dimension]: 'A'
        }
      };
      aggregations[`compare_${dimension}`].filters.filters.B = {
        term: {
          [dimension]: 'B'
        }
      };
    }
    
    // Add sub-aggregations for metrics
    const numericFields = this.getNumericFields(context.schema);
    if (numericFields.length > 0) {
      // Add stats for each bucket (they're automatically applied to each filter bucket)
      aggregations[`compare_${dimension}`].aggs = {};
      for (const numField of numericFields.slice(0, 3)) { // Limit to 3 metrics
        aggregations[`compare_${dimension}`].aggs[`stats_${numField}`] = {
          stats: {
            field: numField
          }
        };
      }
    }
    
    return aggregations;
  }

  /**
   * Helper: Get numeric fields from schema
   */
  getNumericFields(schema) {
    const numericFields = [];
    
    if (!schema || !schema.mappings || !schema.mappings.properties) {
      return numericFields;
    }
    
    // Find numeric fields in schema
    for (const [field, mapping] of Object.entries(schema.mappings.properties)) {
      if (mapping.type === 'long' || 
          mapping.type === 'integer' || 
          mapping.type === 'short' || 
          mapping.type === 'byte' ||
          mapping.type === 'double' || 
          mapping.type === 'float' || 
          mapping.type === 'half_float') {
        numericFields.push(field);
      }
    }
    
    return numericFields;
  }

  /**
   * Helper: Get categorical fields from schema
   */
  getCategoricalFields(schema) {
    const categoricalFields = [];
    
    if (!schema || !schema.mappings || !schema.mappings.properties) {
      return categoricalFields;
    }
    
    // Find keyword fields in schema
    for (const [field, mapping] of Object.entries(schema.mappings.properties)) {
      if (mapping.type === 'keyword' || 
          (mapping.type === 'text' && mapping.fields && mapping.fields.keyword)) {
        categoricalFields.push(field);
      }
    }
    
    return categoricalFields;
  }

  /**
   * Helper: Get nested field from schema object
   */
  getNestedField(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (!current[part]) return null;
      current = current[part];
    }
    
    return current;
  }
}

export default QueryBuildingTool;
