// src/agent/tools/elasticsearch/IntentParsingTool.js

/**
 * IntentParsingTool
 * 
 * Parses natural language input into structured Elasticsearch query intent.
 * Identifies key elements like entity types, fields, filters, timeframes, and analysis needs.
 */
class IntentParsingTool {
  constructor() {
    this.name = 'parseIntent';
    this.description = 'Parses natural language into Elasticsearch query intent';
  }

  /**
   * Execute the intent parsing process on user input
   * 
   * @param {Object} params - The parameters for intent parsing
   * @param {string} params.text - The natural language user input to parse
   * @param {Object} params.context - Context information including schema
   * @returns {Promise<Object>} - The parsed intent structure
   */
  async execute(params) {
    const { text, context = {} } = params;
    
    if (!text) {
      throw new Error('No text provided for intent parsing');
    }
    
    try {
      // Extract the core intent components from text
      const queryType = this.determineQueryType(text);
      const entities = this.extractEntities(text, context);
      const filters = this.extractFilters(text, context);
      const timeframe = this.extractTimeframe(text);
      const fields = this.extractFields(text, context);
      const aggregations = this.extractAggregations(text, context);
      const sorting = this.extractSorting(text);
      const limit = this.extractLimit(text);
      
      // Assemble the parsed intent
      const parsedIntent = {
        queryType,
        originalText: text,
        entities,
        filters,
        timeframe,
        fields,
        aggregations,
        sorting,
        limit,
        confidence: 0.85, // Placeholder - in a real implementation this would be calculated
      };

      // Post-processing to refine intent based on rules
      return this.refineIntent(parsedIntent, context);
      
    } catch (error) {
      console.error('Error parsing intent:', error);
      throw new Error(`Failed to parse intent: ${error.message}`);
    }
  }
  
  /**
   * Determine the high-level query type from user input
   */
  determineQueryType(text) {
    const textLower = text.toLowerCase();
    
    // Check for aggregation/analysis intentions
    if (
      textLower.includes('aggregate') || 
      textLower.includes('group by') || 
      textLower.includes('count of') || 
      textLower.includes('average') ||
      textLower.includes('sum of') ||
      textLower.includes('stats') ||
      textLower.includes('metrics') ||
      textLower.includes('distribution')
    ) {
      return 'aggregation';
    }
    
    // Check for time-based analysis
    if (
      textLower.includes('trend') ||
      textLower.includes('over time') ||
      textLower.includes('time series') ||
      textLower.includes('histogram') ||
      textLower.includes('last hour') ||
      textLower.includes('daily')
    ) {
      return 'time_series';
    }
    
    // Check for geospatial queries
    if (
      textLower.includes('location') ||
      textLower.includes('near') ||
      textLower.includes('within') ||
      textLower.includes('geo') ||
      textLower.includes('distance') ||
      textLower.includes('coordinates')
    ) {
      return 'geospatial';
    }
    
    // Default to search if no specific type identified
    return 'search';
  }
  
  /**
   * Extract entity information from the query text
   */
  extractEntities(text, context) {
    const textLower = text.toLowerCase();
    const entities = [];
    
    // Extract entity types from schema if available
    if (context.schema && context.schema.mappings && context.schema.mappings.properties) {
      const schemaFields = context.schema.mappings.properties;
      
      // Look for field names in the text that might represent main entities
      for (const field in schemaFields) {
        // Skip technical or metadata fields
        if (field.startsWith('_') || field === 'id') continue;
        
        // Check if the field name appears in the text
        if (textLower.includes(field.toLowerCase())) {
          entities.push({
            type: field,
            confidence: 0.8
          });
        }
        
        // Also check for field aliases or human-readable variations
        const fieldWords = field.split('_').join(' ');
        if (fieldWords !== field && textLower.includes(fieldWords)) {
          entities.push({
            type: field,
            confidence: 0.75
          });
        }
      }
    }
    
    // Extract common entity types through pattern matching
    const entityPatterns = [
      { regex: /\b(logs?|events?)\b/i, type: 'log' },
      { regex: /\b(users?|accounts?|profiles?)\b/i, type: 'user' },
      { regex: /\b(orders?|transactions?|purchases?)\b/i, type: 'transaction' },
      { regex: /\b(products?|items?|services?)\b/i, type: 'product' },
      { regex: /\b(errors?|exceptions?|failures?)\b/i, type: 'error' },
      { regex: /\b(documents?|files?|attachments?)\b/i, type: 'document' }
    ];
    
    for (const pattern of entityPatterns) {
      if (pattern.regex.test(text)) {
        entities.push({
          type: pattern.type,
          confidence: 0.7
        });
      }
    }
    
    // Remove duplicate entities
    return [...new Map(entities.map(item => [item.type, item])).values()];
  }
  
  /**
   * Extract filter conditions from the query text
   */
  extractFilters(text, context) {
    const textLower = text.toLowerCase();
    const filters = [];
    
    // Helper function to find a field in schema
    const findSchemaField = (fieldHint) => {
      if (!context.schema || !context.schema.mappings || !context.schema.mappings.properties) {
        return null;
      }
      
      // Try direct match
      if (context.schema.mappings.properties[fieldHint]) {
        return {
          name: fieldHint,
          type: context.schema.mappings.properties[fieldHint].type
        };
      }
      
      // Try fuzzy match
      for (const field in context.schema.mappings.properties) {
        if (
          field.toLowerCase().includes(fieldHint.toLowerCase()) ||
          fieldHint.toLowerCase().includes(field.toLowerCase())
        ) {
          return {
            name: field,
            type: context.schema.mappings.properties[field].type
          };
        }
      }
      
      return null;
    };
    
    // Extract equality filters
    const equalityPatterns = [
      /\b(where|with)\s+(\w+)\s+(is|=|==)\s+['"]?([^'"]+)['"]?/i,
      /\b(\w+)\s+(is|=|==)\s+['"]?([^'"]+)['"]?/i,
      /\b(status|state)\s+(['"]?[^'"]+['"]?)/i
    ];
    
    for (const pattern of equalityPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const [_, maybeField1, maybeField2, maybeValue1, maybeValue2] = matches;
        const fieldHint = maybeField1 || maybeField2;
        const value = maybeValue2 || maybeValue1;
        
        if (fieldHint && value) {
          const fieldInfo = findSchemaField(fieldHint);
          
          filters.push({
            field: fieldInfo ? fieldInfo.name : fieldHint,
            operator: 'eq',
            value: value.replace(/['"]/g, '').trim(),
            confidence: fieldInfo ? 0.85 : 0.6
          });
        }
      }
    }
    
    // Extract range filters
    const rangePatterns = [
      /\b(\w+)\s+(greater than|more than|>|>=|above)\s+([0-9.]+)/i,
      /\b(\w+)\s+(less than|<|<=|below|under)\s+([0-9.]+)/i,
      /\b(\w+)\s+between\s+([0-9.]+)\s+and\s+([0-9.]+)/i
    ];
    
    for (const pattern of rangePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const [_, fieldHint, operator, value1, value2] = matches;
        const fieldInfo = findSchemaField(fieldHint);
        
        // Determine the range operator
        let rangeOperator;
        if (operator.match(/greater than|more than|>|above/i)) {
          rangeOperator = 'gt';
        } else if (operator.match(/>=/) || operator.includes('or equal')) {
          rangeOperator = 'gte';
        } else if (operator.match(/less than|<|below|under/i)) {
          rangeOperator = 'lt';
        } else if (operator.match(/<=/) || operator.includes('or equal')) {
          rangeOperator = 'lte';
        } else if (operator.match(/between/i)) {
          // For between, create two filters
          filters.push({
            field: fieldInfo ? fieldInfo.name : fieldHint,
            operator: 'gte',
            value: parseFloat(value1),
            confidence: fieldInfo ? 0.85 : 0.6
          });
          
          filters.push({
            field: fieldInfo ? fieldInfo.name : fieldHint,
            operator: 'lte',
            value: parseFloat(value2),
            confidence: fieldInfo ? 0.85 : 0.6
          });
          continue;
        }
        
        if (rangeOperator) {
          filters.push({
            field: fieldInfo ? fieldInfo.name : fieldHint,
            operator: rangeOperator,
            value: parseFloat(value1),
            confidence: fieldInfo ? 0.85 : 0.6
          });
        }
      }
    }
    
    // Extract existence filters
    const existencePatterns = [
      /\b(\w+)\s+exists\b/i,
      /\b(\w+)\s+is\s+(not\s+)?null\b/i,
      /\b(with|has)\s+(\w+)\b/i
    ];
    
    for (const pattern of existencePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const [_, prefix, fieldHint, negation] = matches;
        const actualField = fieldHint || prefix;
        const fieldInfo = findSchemaField(actualField);
        
        filters.push({
          field: fieldInfo ? fieldInfo.name : actualField,
          operator: negation ? 'missing' : 'exists',
          confidence: fieldInfo ? 0.8 : 0.6
        });
      }
    }
    
    // Add special case for searching text
    const searchTermPatterns = [
      /\s(contains|having|with)\s+['"]([^'"]+)['"]/i,
      /\s(contains|having|with)\s+the\s+\w+\s+['"]([^'"]+)['"]/i,
      /\bfind\s+['"]([^'"]+)['"]/i
    ];
    
    for (const pattern of searchTermPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const searchTerm = matches[matches.length - 1];
        
        // Try to identify the field to search in if specified
        let searchField = null;
        const fieldPatterns = [
          new RegExp(`in\\s+(\\w+)\\s+contains`, 'i'),
          new RegExp(`(\\w+)\\s+contains`, 'i'),
          new RegExp(`in\\s+(\\w+)\\s+field`, 'i')
        ];
        
        for (const fieldPattern of fieldPatterns) {
          const fieldMatch = text.match(fieldPattern);
          if (fieldMatch) {
            const fieldHint = fieldMatch[1];
            const fieldInfo = findSchemaField(fieldHint);
            searchField = fieldInfo ? fieldInfo.name : fieldHint;
            break;
          }
        }
        
        filters.push({
          field: searchField || '_all',
          operator: 'contains',
          value: searchTerm,
          confidence: searchField ? 0.8 : 0.7
        });
      }
    }
    
    return filters;
  }
  
  /**
   * Extract timeframe information from the query
   */
  extractTimeframe(text) {
    const textLower = text.toLowerCase();
    let timeframe = null;
    
    // Check for specific time ranges
    const timeRangePatterns = [
      { 
        regex: /last\s+(\d+)\s+(minute|hour|day|week|month|year)s?/i,
        handler: (matches) => ({ 
          type: 'relative', 
          unit: matches[2].toLowerCase(), 
          value: parseInt(matches[1]),
          field: '@timestamp'
        })
      },
      {
        regex: /past\s+(\d+)\s+(minute|hour|day|week|month|year)s?/i,
        handler: (matches) => ({ 
          type: 'relative', 
          unit: matches[2].toLowerCase(), 
          value: parseInt(matches[1]),
          field: '@timestamp'
        })
      },
      {
        regex: /since\s+(\d{4}-\d{2}-\d{2})/i,
        handler: (matches) => ({
          type: 'absolute',
          start: matches[1],
          field: '@timestamp'
        })
      },
      {
        regex: /from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i,
        handler: (matches) => ({
          type: 'absolute',
          start: matches[1],
          end: matches[2],
          field: '@timestamp'
        })
      },
      {
        regex: /today|yesterday|this week|this month/i,
        handler: (matches) => {
          const period = matches[0].toLowerCase();
          return {
            type: 'named',
            period,
            field: '@timestamp'
          };
        }
      }
    ];
    
    for (const pattern of timeRangePatterns) {
      const matches = textLower.match(pattern.regex);
      if (matches) {
        timeframe = pattern.handler(matches);
        
        // Check for custom timestamp field
        const fieldMatch = textLower.match(/using\s+(\w+)\s+as\s+timestamp/i) || 
                         textLower.match(/timestamp\s+field\s+(\w+)/i) ||
                         textLower.match(/time\s+field\s+(\w+)/i);
        
        if (fieldMatch) {
          timeframe.field = fieldMatch[1];
        }
        
        break;
      }
    }
    
    // If we've detected a time-based query but no specific timeframe,
    // default to last 24 hours
    if (!timeframe && (
      textLower.includes('recent') || 
      textLower.includes('latest') ||
      this.determineQueryType(text) === 'time_series'
    )) {
      timeframe = {
        type: 'relative',
        unit: 'hour',
        value: 24,
        field: '@timestamp'
      };
    }
    
    return timeframe;
  }
  
  /**
   * Extract field specifications from the query
   */
  extractFields(text, context) {
    const textLower = text.toLowerCase();
    const fields = [];
    
    // Look for field specifications
    const fieldPatterns = [
      /\b(?:show|return|display|include)\s+(?:the\s+)?(?:field|fields|columns?)\s+([^.]+?)(?:\s+and|\s*$)/i,
      /\b(?:show|return|display|include)\s+([^.]+?)(?:\s+from|\s+in|\s*$)/i
    ];
    
    for (const pattern of fieldPatterns) {
      const matches = textLower.match(pattern);
      if (matches) {
        const fieldList = matches[1].split(/(?:,|\s+and\s+)/);
        
        for (let fieldName of fieldList) {
          fieldName = fieldName.trim();
          if (!fieldName || fieldName === 'all' || fieldName === '*') continue;
          
          // Try to match with schema fields if schema is available
          if (context.schema && context.schema.mappings && context.schema.mappings.properties) {
            let matchedField = null;
            
            // Direct match
            if (context.schema.mappings.properties[fieldName]) {
              matchedField = fieldName;
            } else {
              // Fuzzy match
              for (const schemaField in context.schema.mappings.properties) {
                if (
                  schemaField.toLowerCase().includes(fieldName) ||
                  schemaField.toLowerCase().replace('_', '') === fieldName.replace(' ', '')
                ) {
                  matchedField = schemaField;
                  break;
                }
              }
            }
            
            if (matchedField) {
              fields.push({
                name: matchedField,
                confidence: 0.9
              });
            } else {
              fields.push({
                name: fieldName,
                confidence: 0.6
              });
            }
          } else {
            // Without schema, just use the field as is
            fields.push({
              name: fieldName,
              confidence: 0.6
            });
          }
        }
      }
    }
    
    // If fields detected in filters but not explicitly requested, add them
    if (fields.length === 0) {
      const filtersWithFields = this.extractFilters(text, context);
      
      for (const filter of filtersWithFields) {
        if (filter.field && filter.field !== '_all' && !fields.some(f => f.name === filter.field)) {
          fields.push({
            name: filter.field,
            confidence: 0.7
          });
        }
      }
    }
    
    return fields;
  }
  
  /**
   * Extract aggregation requirements from the query
   */
  extractAggregations(text, context) {
    const textLower = text.toLowerCase();
    const aggregations = [];
    
    // Check for common aggregation patterns
    const aggregationPatterns = [
      {
        regex: /\b(count|group)\s+by\s+(\w+)/i,
        type: 'terms',
        fieldIndex: 2
      },
      {
        regex: /\b(average|avg)\s+(\w+)/i,
        type: 'avg',
        fieldIndex: 2
      },
      {
        regex: /\b(sum|total)\s+of\s+(\w+)/i,
        type: 'sum',
        fieldIndex: 2
      },
      {
        regex: /\b(min|minimum)\s+(\w+)/i,
        type: 'min',
        fieldIndex: 2
      },
      {
        regex: /\b(max|maximum)\s+(\w+)/i,
        type: 'max',
        fieldIndex: 2
      },
      {
        regex: /\b(stats|statistics)\s+for\s+(\w+)/i,
        type: 'stats',
        fieldIndex: 2
      },
      {
        regex: /\b(percentiles)\s+of\s+(\w+)/i,
        type: 'percentiles',
        fieldIndex: 2
      },
      {
        regex: /\btop\s+(\d+)\s+(\w+)/i,
        type: 'terms',
        sizeIndex: 1,
        fieldIndex: 2
      },
      {
        regex: /\b(distribution|histogram)\s+of\s+(\w+)/i,
        type: 'histogram',
        fieldIndex: 2
      }
    ];
    
    for (const pattern of aggregationPatterns) {
      const matches = textLower.match(pattern.regex);
      if (matches) {
        const fieldHint = matches[pattern.fieldIndex];
        let field = fieldHint;
        let confidence = 0.7;
        
        // Try to match with schema fields if schema is available
        if (context.schema && context.schema.mappings && context.schema.mappings.properties) {
          // Direct match
          if (context.schema.mappings.properties[fieldHint]) {
            field = fieldHint;
            confidence = 0.9;
          } else {
            // Fuzzy match
            for (const schemaField in context.schema.mappings.properties) {
              if (
                schemaField.toLowerCase().includes(fieldHint) ||
                schemaField.toLowerCase().replace('_', '') === fieldHint.replace(' ', '')
              ) {
                field = schemaField;
                confidence = 0.8;
                break;
              }
            }
          }
        }
        
        const agg = {
          type: pattern.type,
          field,
          confidence
        };
        
        // Add size if specified (for terms agg)
        if (pattern.sizeIndex && matches[pattern.sizeIndex]) {
          agg.size = parseInt(matches[pattern.sizeIndex]);
        }
        
        // For histograms, check for interval specification
        if (pattern.type === 'histogram' || pattern.type === 'date_histogram') {
          const intervalMatch = textLower.match(/\binterval\s+of\s+(\d+)\s*(\w+)?/i) ||
                              textLower.match(/\bby\s+(\d+)\s*(\w+)/i);
          
          if (intervalMatch) {
            agg.interval = intervalMatch[1];
            if (intervalMatch[2]) {
              agg.interval_unit = intervalMatch[2];
            }
          }
        }
        
        aggregations.push(agg);
      }
    }
    
    // Special case for date histograms (time series)
    if (this.determineQueryType(text) === 'time_series') {
      // Extract the time field
      let timeField = '@timestamp';
      const timeFieldMatch = textLower.match(/using\s+(\w+)\s+as\s+timestamp/i) || 
                           textLower.match(/timestamp\s+field\s+(\w+)/i) ||
                           textLower.match(/time\s+field\s+(\w+)/i);
      
      if (timeFieldMatch) {
        timeField = timeFieldMatch[1];
      }
      
      // Determine interval
      let interval = 'hour';
      const intervalPatterns = [
        { regex: /hourly|by hour|per hour/i, interval: 'hour' },
        { regex: /daily|by day|per day/i, interval: 'day' },
        { regex: /weekly|by week|per week/i, interval: 'week' },
        { regex: /monthly|by month|per month/i, interval: 'month' },
        { regex: /yearly|by year|per year/i, interval: 'year' },
        { regex: /every\s+(\d+)\s+(minute|hour|day|week|month|year)s?/i, handler: (m) => `${m[1]}${m[2].charAt(0)}` }
      ];
      
      for (const pattern of intervalPatterns) {
        const matches = textLower.match(pattern.regex);
        if (matches) {
          interval = pattern.handler ? pattern.handler(matches) : pattern.interval;
          break;
        }
      }
      
      aggregations.push({
        type: 'date_histogram',
        field: timeField,
        interval,
        confidence: 0.8
      });
    }
    
    return aggregations;
  }
  
  /**
   * Extract sorting requirements from the query
   */
  extractSorting(text) {
    const textLower = text.toLowerCase();
    const sorting = [];
    
    // Check for sort specifications
    const sortPatterns = [
      {
        regex: /\b(?:sort|order)\s+by\s+(\w+)\s+(asc|ascending|desc|descending)/i,
        fieldIndex: 1,
        orderIndex: 2
      },
      {
        regex: /\b(?:sort|order)\s+(?:by|on)\s+(\w+)/i,
        fieldIndex: 1
      },
      {
        regex: /\bin\s+(asc|ascending|desc|descending)\s+order/i,
        orderIndex: 1
      }
    ];
    
    for (const pattern of sortPatterns) {
      const matches = textLower.match(pattern.regex);
      if (matches) {
        const sortSpec = {};
        
        if (pattern.fieldIndex) {
          sortSpec.field = matches[pattern.fieldIndex];
        }
        
        if (pattern.orderIndex) {
          const orderMatch = matches[pattern.orderIndex].toLowerCase();
          sortSpec.order = orderMatch.startsWith('asc') ? 'asc' : 'desc';
        } else {
          // Default to descending if no order specified
          sortSpec.order = 'desc';
        }
        
        // Add to sorting array if we have a field
        if (sortSpec.field) {
          sorting.push(sortSpec);
        } else if (sorting.length > 0 && !sorting[sorting.length - 1].order) {
          // If we have a previous sort spec without order, apply this order to it
          sorting[sorting.length - 1].order = sortSpec.order;
        }
      }
    }
    
    // Check for special cases
    if (textLower.includes('latest') || textLower.includes('most recent')) {
      // Sort by timestamp descending
      if (!sorting.some(s => s.field === '@timestamp')) {
        sorting.push({
          field: '@timestamp',
          order: 'desc'
        });
      }
    } else if (textLower.includes('oldest') || textLower.includes('earliest')) {
      // Sort by timestamp ascending
      if (!sorting.some(s => s.field === '@timestamp')) {
        sorting.push({
          field: '@timestamp',
          order: 'asc'
        });
      }
    }
    
    return sorting;
  }
  
  /**
   * Extract result limit information from the query
   */
  extractLimit(text) {
    const textLower = text.toLowerCase();
    let limit = null;
    
    // Check for limit specifications
    const limitPatterns = [
      /\b(?:show|return|get|find|limit)\s+(?:the\s+)?(?:top|first)\s+(\d+)/i,
      /\blimit\s+(?:to\s+)?(\d+)/i,
      /\b(\d+)\s+results?\b/i
    ];
    
    for (const pattern of limitPatterns) {
      const matches = textLower.match(pattern);
      if (matches && matches[1]) {
        limit = parseInt(matches[1]);
        break;
      }
    }
    
    // Default to 10 if the query type suggests a search with results
    if (limit === null && this.determineQueryType(text) === 'search') {
      limit = 10;
    }
    
    return limit;
  }
  
  /**
   * Apply additional refinements to the parsed intent based on rules and context
   */
  refineIntent(parsedIntent, context) {
    // If query type is aggregation but no aggregations were extracted, add a default one
    if (parsedIntent.queryType === 'aggregation' && parsedIntent.aggregations.length === 0) {
      // Try to find a suitable field for aggregation
      let aggField = null;
      
      // If we have filters, try using one of their fields
      if (parsedIntent.filters.length > 0) {
        aggField = parsedIntent.filters[0].field;
      } 
      // If we have fields specified, use the first one
      else if (parsedIntent.fields.length > 0) {
        aggField = parsedIntent.fields[0].name;
      }
      // Otherwise try to find a good candidate field from schema
      else if (context.schema && context.schema.analysis && context.schema.analysis.aggregatableFields) {
        aggField = context.schema.analysis.aggregatableFields[0];
      }
      
      if (aggField) {
        parsedIntent.aggregations.push({
          type: 'terms',
          field: aggField,
          confidence: 0.6
        });
      }
    }
    
    // For time series queries, ensure we have a date histogram
    if (parsedIntent.queryType === 'time_series' && 
        !parsedIntent.aggregations.some(a => a.type === 'date_histogram')) {
      // Try to find a suitable date field
      let dateField = '@timestamp';
      
      if (context.schema && context.schema.analysis && context.schema.analysis.dateFields) {
        dateField = context.schema.analysis.dateFields[0] || dateField;
      }
      
      parsedIntent.aggregations.push({
        type: 'date_histogram',
        field: dateField,
        interval: 'hour',
        confidence: 0.7
      });
    }
    
    return parsedIntent;
  }
}

export default IntentParsingTool;
