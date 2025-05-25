// src/agent/tools/elasticsearch/ValidationTool.js

/**
 * ValidationTool
 * 
 * This tool validates Elasticsearch query syntax and semantics to ensure
 * that generated queries are valid before execution. It performs structural
 * validation, field validation against schema, and provides suggestions for
 * query improvements.
 */
class ValidationTool {
  constructor() {
    this.name = 'validateQuery';
    this.description = 'Validates Elasticsearch query syntax and semantics';
  }

  /**
   * Executes the validation process for an Elasticsearch query
   * 
   * @param {Object} params - Validation parameters
   * @param {Object} params.query - The Elasticsearch query to validate
   * @param {Object} params.context - Context with schema and cluster info
   * @returns {Object} - Validation result with valid flag, errors, warnings, suggestions
   */
  async execute(params) {
    const { query, context } = params;
    
    if (!query) {
      return {
        valid: false,
        errors: ['No query provided for validation'],
        warnings: [],
        suggestions: []
      };
    }

    // Initialize validation results
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Perform various validation checks
    this.validateQueryStructure(query, validationResult);
    
    // Only validate against schema if structure is valid
    if (validationResult.valid && context.schema) {
      this.validateAgainstSchema(query, context.schema, validationResult);
    }
    
    // Check for query performance issues
    this.checkQueryPerformance(query, validationResult);
    
    // Suggest optimizations
    this.suggestOptimizations(query, validationResult);
    
    // Final validity determination - valid only if no errors
    validationResult.valid = validationResult.errors.length === 0;
    
    return validationResult;
  }
  
  /**
   * Validates the basic structure of an Elasticsearch query
   */
  validateQueryStructure(query, result) {
    // Check if query is an object
    if (typeof query !== 'object' || query === null) {
      result.errors.push('Query must be a valid JSON object');
      return;
    }
    
    // Validate query clause exists if necessary
    if (!query.aggs && !query.query) {
      result.warnings.push('Query contains neither a query clause nor aggregations');
      result.suggestions.push('Add at least a query clause or aggregations to make a valid request');
    }
    
    // Check query clause structure if present
    if (query.query) {
      this.validateQueryClause(query.query, result);
    }
    
    // Check aggregations if present
    if (query.aggs) {
      this.validateAggregations(query.aggs, result);
    }
    
    // Validate pagination parameters
    if (query.from !== undefined && (typeof query.from !== 'number' || query.from < 0)) {
      result.errors.push('Parameter "from" must be a non-negative integer');
    }
    
    if (query.size !== undefined && (typeof query.size !== 'number' || query.size < 0)) {
      result.errors.push('Parameter "size" must be a non-negative integer');
    }
    
    // Validate sort if present
    if (query.sort) {
      this.validateSortClause(query.sort, result);
    }
    
    // Validate highlights if present
    if (query.highlight) {
      if (!query.highlight.fields || typeof query.highlight.fields !== 'object') {
        result.errors.push('Highlight must contain a "fields" object');
      }
    }
  }
  
  /**
   * Validates the query clause structure
   */
  validateQueryClause(queryClause, result) {
    // Must have at least one valid query type
    const validQueryTypes = [
      'match', 'match_phrase', 'match_all', 'term', 'terms', 'range',
      'exists', 'prefix', 'wildcard', 'regexp', 'fuzzy', 'type',
      'ids', 'multi_match', 'query_string', 'simple_query_string',
      'bool', 'dis_max', 'function_score', 'boosting'
    ];
    
    const queryType = Object.keys(queryClause)[0];
    
    // Check if query type is valid
    if (!validQueryTypes.includes(queryType)) {
      result.errors.push(`Invalid query type: "${queryType}". Must be one of ${validQueryTypes.join(', ')}`);
      return;
    }
    
    // Validate bool query - most common compound query
    if (queryType === 'bool') {
      this.validateBoolQuery(queryClause.bool, result);
    }
    
    // Validate function_score query
    if (queryType === 'function_score') {
      if (!queryClause.function_score.query) {
        result.warnings.push('function_score query should contain a "query" property');
      }
      
      if (!queryClause.function_score.functions || !Array.isArray(queryClause.function_score.functions)) {
        result.errors.push('function_score must contain a "functions" array');
      }
    }
    
    // Validate range queries
    if (queryType === 'range') {
      for (const [field, rangeConditions] of Object.entries(queryClause.range)) {
        const hasValidOperator = ['gt', 'gte', 'lt', 'lte'].some(op => rangeConditions[op] !== undefined);
        if (!hasValidOperator) {
          result.errors.push(`Range query for field "${field}" must include at least one range operator (gt, gte, lt, lte)`);
        }
      }
    }
  }
  
  /**
   * Validates the structure of a bool query
   */
  validateBoolQuery(boolQuery, result) {
    if (!boolQuery) {
      result.errors.push('Bool query is empty');
      return;
    }
    
    // Bool query should have at least one clause
    const hasClause = ['must', 'should', 'filter', 'must_not'].some(
      clause => boolQuery[clause] !== undefined
    );
    
    if (!hasClause) {
      result.errors.push('Bool query must contain at least one clause (must, should, filter, or must_not)');
      return;
    }
    
    // Verify each clause is properly formatted
    const clauses = ['must', 'should', 'filter', 'must_not'];
    for (const clause of clauses) {
      if (boolQuery[clause]) {
        if (!Array.isArray(boolQuery[clause]) && typeof boolQuery[clause] !== 'object') {
          result.errors.push(`Bool query "${clause}" must be an object or array of objects`);
        }
        
        if (Array.isArray(boolQuery[clause]) && boolQuery[clause].length === 0) {
          result.warnings.push(`Bool query contains empty "${clause}" array`);
        }
      }
    }
    
    // Check minimum_should_match with should clause
    if (boolQuery.should && boolQuery.minimum_should_match === undefined && 
        (!boolQuery.must || boolQuery.must.length === 0) && 
        (!boolQuery.filter || boolQuery.filter.length === 0)) {
      result.warnings.push('Bool query with "should" clause but without "must" or "filter" should include "minimum_should_match"');
      result.suggestions.push('Add "minimum_should_match" parameter to control how many "should" clauses need to match');
    }
  }
  
  /**
   * Validates aggregation structure
   */
  validateAggregations(aggs, result) {
    if (typeof aggs !== 'object' || aggs === null) {
      result.errors.push('Aggregations must be a valid object');
      return;
    }
    
    // Valid aggregation types
    const validAggTypes = [
      'terms', 'range', 'date_range', 'histogram', 'date_histogram',
      'avg', 'sum', 'min', 'max', 'stats', 'extended_stats', 
      'percentiles', 'cardinality', 'filter', 'filters', 
      'nested', 'top_hits', 'geo_distance'
    ];
    
    // Check each aggregation
    for (const [aggName, aggConfig] of Object.entries(aggs)) {
      // Each aggregation should have exactly one agg type
      const aggType = Object.keys(aggConfig).find(key => key !== 'aggs');
      
      if (!aggType) {
        result.errors.push(`Aggregation "${aggName}" does not contain a valid aggregation type`);
        continue;
      }
      
      if (!validAggTypes.includes(aggType)) {
        result.warnings.push(`Aggregation type "${aggType}" in "${aggName}" may not be valid`);
      }
      
      // Check field parameter for most aggs
      if (['terms', 'range', 'histogram', 'date_histogram', 'avg', 'sum', 'min', 'max', 
           'stats', 'extended_stats', 'percentiles', 'cardinality'].includes(aggType)) {
        if (!aggConfig[aggType].field) {
          result.errors.push(`Aggregation "${aggName}" of type "${aggType}" must have a "field" parameter`);
        }
      }
      
      // Validate sub-aggregations recursively
      if (aggConfig.aggs) {
        this.validateAggregations(aggConfig.aggs, result);
      }
    }
  }
  
  /**
   * Validates sort clause structure
   */
  validateSortClause(sort, result) {
    if (!Array.isArray(sort) && typeof sort !== 'object') {
      result.errors.push('Sort parameter must be an array or object');
      return;
    }
    
    // Convert to array for uniform processing
    const sortArray = Array.isArray(sort) ? sort : [sort];
    
    for (const sortItem of sortArray) {
      if (typeof sortItem === 'string') {
        // Simple field name is fine
        continue;
      } else if (typeof sortItem === 'object') {
        // Object should have one field with order
        const field = Object.keys(sortItem)[0];
        const order = sortItem[field].order;
        
        if (order && !['asc', 'desc'].includes(order)) {
          result.errors.push(`Sort order must be "asc" or "desc", got "${order}"`);
        }
      } else {
        result.errors.push('Each sort item must be a string or object');
      }
    }
  }
  
  /**
   * Validates query against provided Elasticsearch schema
   */
  validateAgainstSchema(query, schema, result) {
    if (!schema || !schema.mappings || !schema.mappings.properties) {
      result.warnings.push('Schema information is incomplete; cannot validate field names');
      return;
    }
    
    // Get all fields used in the query
    const usedFields = this.extractQueryFields(query);
    const schemaFields = this.flattenSchemaFields(schema.mappings.properties);
    
    // Check each field against schema
    for (const fieldInfo of usedFields) {
      const { field, context: fieldContext } = fieldInfo;
      
      // Skip special fields that start with _
      if (field.startsWith('_')) continue;
      
      // Check if field exists in schema
      if (!schemaFields.some(f => f.field === field)) {
        result.warnings.push(`Field "${field}" used in ${fieldContext} does not exist in the schema`);
        
        // Suggest similar fields
        const similarFields = this.findSimilarFields(field, schemaFields.map(f => f.field));
        if (similarFields.length > 0) {
          result.suggestions.push(`Did you mean one of these fields: ${similarFields.join(', ')}?`);
        }
      } else {
        // Field exists, check if correct usage based on field type
        const fieldSchema = schemaFields.find(f => f.field === field);
        if (fieldSchema) {
          this.validateFieldUsage(fieldInfo, fieldSchema, result);
        }
      }
    }
  }
  
  /**
   * Validates correct field usage based on field type
   */
  validateFieldUsage(fieldInfo, fieldSchema, result) {
    const { field, queryType, context: fieldContext } = fieldInfo;
    
    // Check if field type is compatible with query type
    switch (queryType) {
      case 'term':
      case 'terms':
        if (fieldSchema.type === 'text' && !field.includes('.keyword')) {
          result.warnings.push(`Using "${queryType}" query on analyzed text field "${field}" may not work as expected`);
          result.suggestions.push(`Consider using "${field}.keyword" for exact matching on text fields`);
        }
        break;
        
      case 'match':
      case 'match_phrase':
      case 'query_string':
      case 'multi_match':
        if (fieldSchema.type !== 'text' && fieldSchema.type !== 'string') {
          result.warnings.push(`Using "${queryType}" on non-text field "${field}" (${fieldSchema.type}) may not work as expected`);
          result.suggestions.push(`Consider using "term" query for exact matching on ${fieldSchema.type} fields`);
        }
        break;
        
      case 'range':
        if (!['date', 'long', 'integer', 'short', 'byte', 'double', 'float', 'half_float'].includes(fieldSchema.type)) {
          result.warnings.push(`Range query on field "${field}" of type "${fieldSchema.type}" may not work as expected`);
        }
        break;
        
      case 'aggregation':
        if (fieldSchema.type === 'text' && !field.includes('.keyword')) {
          result.warnings.push(`Using aggregation on analyzed text field "${field}" may not work as expected`);
          result.suggestions.push(`Consider using "${field}.keyword" for aggregations on text fields`);
        }
        break;
    }
  }
  
  /**
   * Extract all fields used in a query
   */
  extractQueryFields(query, context = 'query') {
    let fields = [];
    
    // Handle query clause
    if (query.query) {
      fields = fields.concat(this.extractQueryFields(query.query, 'query clause'));
    }
    
    // Handle bool queries
    if (query.bool) {
      ['must', 'should', 'filter', 'must_not'].forEach(clause => {
        if (query.bool[clause]) {
          const clauses = Array.isArray(query.bool[clause]) ? query.bool[clause] : [query.bool[clause]];
          
          clauses.forEach(clauseQuery => {
            fields = fields.concat(this.extractQueryFields(clauseQuery, `bool.${clause}`));
          });
        }
      });
    }
    
    // Handle term queries
    if (query.term) {
      const field = Object.keys(query.term)[0];
      fields.push({ field, queryType: 'term', context });
    }
    
    // Handle terms queries
    if (query.terms) {
      const field = Object.keys(query.terms)[0];
      fields.push({ field, queryType: 'terms', context });
    }
    
    // Handle match queries
    if (query.match) {
      const field = Object.keys(query.match)[0];
      fields.push({ field, queryType: 'match', context });
    }
    
    // Handle match_phrase queries
    if (query.match_phrase) {
      const field = Object.keys(query.match_phrase)[0];
      fields.push({ field, queryType: 'match_phrase', context });
    }
    
    // Handle range queries
    if (query.range) {
      const field = Object.keys(query.range)[0];
      fields.push({ field, queryType: 'range', context });
    }
    
    // Handle multi_match queries
    if (query.multi_match && query.multi_match.fields) {
      query.multi_match.fields.forEach(field => {
        // Remove boosting syntax if present
        const cleanField = field.split('^')[0];
        fields.push({ field: cleanField, queryType: 'multi_match', context });
      });
    }
    
    // Handle sort clauses
    if (query.sort) {
      const sortItems = Array.isArray(query.sort) ? query.sort : [query.sort];
      
      sortItems.forEach(item => {
        if (typeof item === 'string') {
          fields.push({ field: item, queryType: 'sort', context: 'sort clause' });
        } else if (typeof item === 'object') {
          const field = Object.keys(item)[0];
          fields.push({ field, queryType: 'sort', context: 'sort clause' });
        }
      });
    }
    
    // Handle aggregations
    if (query.aggs || query.aggregations) {
      const aggs = query.aggs || query.aggregations;
      
      Object.keys(aggs).forEach(aggName => {
        const agg = aggs[aggName];
        const aggType = Object.keys(agg).find(key => key !== 'aggs' && key !== 'aggregations');
        
        if (aggType && agg[aggType].field) {
          fields.push({ 
            field: agg[aggType].field, 
            queryType: 'aggregation', 
            context: `aggregation ${aggName}` 
          });
        }
        
        // Recurse into sub-aggregations
        if (agg.aggs || agg.aggregations) {
          fields = fields.concat(this.extractQueryFields({ 
            aggs: agg.aggs || agg.aggregations 
          }, `sub-aggregation of ${aggName}`));
        }
      });
    }
    
    return fields;
  }
  
  /**
   * Flatten schema fields including nested fields
   */
  flattenSchemaFields(properties, prefix = '') {
    let fields = [];
    
    for (const [fieldName, fieldMapping] of Object.entries(properties)) {
      const fullPath = prefix ? `${prefix}.${fieldName}` : fieldName;
      
      // Add the field with its type
      fields.push({
        field: fullPath,
        type: fieldMapping.type
      });
      
      // Add .keyword for text fields that have it
      if (fieldMapping.type === 'text' && 
          fieldMapping.fields && 
          fieldMapping.fields.keyword) {
        fields.push({
          field: `${fullPath}.keyword`,
          type: 'keyword'
        });
      }
      
      // Recurse into nested properties
      if (fieldMapping.properties) {
        fields = fields.concat(this.flattenSchemaFields(fieldMapping.properties, fullPath));
      }
    }
    
    return fields;
  }
  
  /**
   * Find similar field names using simple string distance
   */
  findSimilarFields(field, schemaFields, limit = 3) {
    // Simple Levenshtein distance implementation
    function levenshteinDistance(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      
      const matrix = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill(0));
      
      for (let i = 0; i <= a.length; i++) {
        matrix[i][0] = i;
      }
      
      for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j;
      }
      
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i-1] === b[j-1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i-1][j] + 1,      // deletion
            matrix[i][j-1] + 1,      // insertion
            matrix[i-1][j-1] + cost  // substitution
          );
        }
      }
      
      return matrix[a.length][b.length];
    }
    
    // Calculate distances
    const distances = schemaFields.map(schemaField => ({
      field: schemaField,
      distance: levenshteinDistance(field.toLowerCase(), schemaField.toLowerCase())
    }));
    
    // Sort by distance and return top matches
    return distances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map(item => item.field);
  }
  
  /**
   * Check for potential performance issues in queries
   */
  checkQueryPerformance(query, result) {
    // Check for queries without filters
    if (query.query && 
        (!query.query.bool || !query.query.bool.filter) && 
        query.size > 10) {
      result.warnings.push('Query fetches multiple documents without filter clauses');
      result.suggestions.push('Consider adding filter clauses to improve performance');
    }
    
    // Check for inefficient wildcard prefixes
    if (query.query && JSON.stringify(query).includes('*')) {
      const wildcardPattern = /"wildcard"\s*:\s*{\s*"[^"]+"\s*:\s*"[*].*"/;
      if (wildcardPattern.test(JSON.stringify(query))) {
        result.warnings.push('Wildcard query with leading asterisk can be very slow');
        result.suggestions.push('Avoid leading wildcards (*term) as they cannot use index optimizations');
      }
    }
    
    // Check for large size parameter in terms aggregations
    if (query.aggs) {
      const checkAggs = (aggs) => {
        for (const [aggName, aggConfig] of Object.entries(aggs)) {
          if (aggConfig.terms && aggConfig.terms.size && aggConfig.terms.size > 1000) {
            result.warnings.push(`Terms aggregation "${aggName}" has a large size (${aggConfig.terms.size})`);
            result.suggestions.push(`Consider reducing the size parameter for "${aggName}" to improve performance`);
          }
          
          // Check nested aggregations
          if (aggConfig.aggs) {
            checkAggs(aggConfig.aggs);
          }
        }
      };
      
      checkAggs(query.aggs);
    }
    
    // Check for very large result sets
    if (query.size > 1000) {
      result.warnings.push(`Query requests ${query.size} results which may impact performance`);
      result.suggestions.push('Consider using search_after or scroll API for large result sets');
    }
  }
  
  /**
   * Suggest query optimizations
   */
  suggestOptimizations(query, result) {
    // Suggest _source filtering if fetching many documents
    if (query.size > 10 && !query._source) {
      result.suggestions.push('Consider using _source filtering to reduce response size');
    }
    
    // Suggest doc_values where appropriate
    if (query.script_fields || 
        (query.sort && JSON.stringify(query.sort).includes('_score')) ||
        query.track_scores) {
      result.suggestions.push('Using doc_values fields can improve sorting and aggregation performance');
    }
    
    // Suggest filter context for clauses that don't need scoring
    if (query.query && query.query.bool && query.query.bool.must) {
      const mustClauses = Array.isArray(query.query.bool.must) 
        ? query.query.bool.must 
        : [query.query.bool.must];
      
      for (const clause of mustClauses) {
        if (clause.term || clause.terms || clause.range || clause.exists) {
          result.suggestions.push('Move term, terms, range, or exists clauses from must to filter for better performance');
          break;
        }
      }
    }
  }
}

export default ValidationTool;
