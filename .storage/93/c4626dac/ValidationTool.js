// src/agent/tools/elasticsearch/ValidationTool.js

/**
 * ValidationTool
 * 
 * Validates Elasticsearch query syntax and semantics.
 * Checks for common errors in query structure and provides
 * suggestions to fix issues.
 */
class ValidationTool {
  constructor() {
    this.name = 'validateQuery';
    this.description = 'Validates Elasticsearch DSL queries for syntax and semantic correctness';
  }

  /**
   * Execute the validation process on a query
   * 
   * @param {Object} params - The parameters for validation
   * @param {Object} params.query - The Elasticsearch query to validate
   * @param {Object} params.context - Context including schema information
   * @returns {Promise<Object>} - Validation results with issues and suggestions
   */
  async execute(params) {
    const { query, context = {} } = params;
    
    if (!query) {
      throw new Error('No query provided for validation');
    }
    
    try {
      // Initialize validation result
      const validationResult = {
        valid: true,
        issues: [],
        suggestions: [],
        query: query // Include the original query
      };
      
      // Perform the validation checks
      this.validateQuerySyntax(query, validationResult);
      this.validateQuerySemantics(query, context, validationResult);
      this.validateBestPractices(query, validationResult);
      
      // Calculate overall validity
      validationResult.valid = validationResult.issues.length === 0;
      
      // If there are critical issues, provide a fixed query
      if (!validationResult.valid) {
        validationResult.fixedQuery = this.attemptQueryFix(query, validationResult.issues);
      }
      
      return validationResult;
    } catch (error) {
      console.error('Error validating query:', error);
      throw new Error(`Failed to validate query: ${error.message}`);
    }
  }
  
  /**
   * Validate the syntax of the query
   */
  validateQuerySyntax(query, result) {
    // Check if the query is a valid object
    if (typeof query !== 'object' || query === null) {
      result.issues.push({
        type: 'syntax',
        severity: 'critical',
        message: 'Query must be a valid JSON object'
      });
      return;
    }
    
    // Check for empty query
    if (Object.keys(query).length === 0) {
      result.issues.push({
        type: 'syntax',
        severity: 'critical',
        message: 'Query cannot be empty'
      });
      return;
    }
    
    // Check for common syntax issues
    this.validateBoolQuery(query, result);
    this.validateAggregations(query, result);
    this.validateSortOrder(query, result);
    
    // Check for missing size with large result request
    if (query.track_total_hits === true && !query.size) {
      result.suggestions.push({
        type: 'syntax',
        severity: 'warning',
        message: 'track_total_hits is true but size is not specified, which might return unexpected number of results'
      });
    }
  }
  
  /**
   * Validate a boolean query structure
   */
  validateBoolQuery(query, result) {
    // Check if there's a bool query
    if (query.query && query.query.bool) {
      const boolQuery = query.query.bool;
      
      // Check for empty bool sections
      const sections = ['must', 'must_not', 'should', 'filter'];
      for (const section of sections) {
        if (boolQuery[section] && !Array.isArray(boolQuery[section])) {
          result.issues.push({
            type: 'syntax',
            severity: 'critical',
            message: `Bool ${section} should be an array`,
            path: `query.bool.${section}`
          });
        }
      }
      
      // Check for should clause without minimum_should_match when no must clauses exist
      if (
        boolQuery.should && 
        Array.isArray(boolQuery.should) && 
        boolQuery.should.length > 0 &&
        (!boolQuery.must || boolQuery.must.length === 0) &&
        (!boolQuery.filter || boolQuery.filter.length === 0) &&
        boolQuery.minimum_should_match === undefined
      ) {
        result.suggestions.push({
          type: 'syntax',
          severity: 'warning',
          message: 'Bool query with should clauses but no must clauses should specify minimum_should_match',
          path: 'query.bool'
        });
      }
    }
  }
  
  /**
   * Validate aggregation structure
   */
  validateAggregations(query, result) {
    if (!query.aggs && !query.aggregations) return;
    
    const aggs = query.aggs || query.aggregations;
    
    // Check for aggs but no size:0, which might be unintentional
    if (query.size !== 0 && !query.size) {
      result.suggestions.push({
        type: 'semantics',
        severity: 'warning',
        message: 'Query has aggregations but no size:0 specified. This will return both aggregations and documents.'
      });
    }
    
    // Check each aggregation
    for (const [aggName, aggDef] of Object.entries(aggs)) {
      // Check for empty aggregation definitions
      if (!aggDef || typeof aggDef !== 'object' || Object.keys(aggDef).length === 0) {
        result.issues.push({
          type: 'syntax',
          severity: 'critical',
          message: `Aggregation "${aggName}" has an empty or invalid definition`,
          path: `aggs.${aggName}`
        });
        continue;
      }
      
      // Check aggregation type
      const aggType = Object.keys(aggDef)[0];
      if (!aggType) {
        result.issues.push({
          type: 'syntax',
          severity: 'critical',
          message: `Aggregation "${aggName}" is missing an aggregation type`,
          path: `aggs.${aggName}`
        });
        continue;
      }
      
      // Validate specific aggregation types
      switch (aggType) {
        case 'terms':
          if (!aggDef.terms.field) {
            result.issues.push({
              type: 'syntax',
              severity: 'critical',
              message: `Terms aggregation "${aggName}" is missing a field parameter`,
              path: `aggs.${aggName}.terms.field`
            });
          }
          
          // Check for terms aggregation with high size
          if (aggDef.terms.size > 1000) {
            result.suggestions.push({
              type: 'performance',
              severity: 'warning',
              message: `Terms aggregation "${aggName}" has a very large size (${aggDef.terms.size}), which may impact performance`,
              path: `aggs.${aggName}.terms.size`
            });
          }
          break;
          
        case 'date_histogram':
          if (!aggDef.date_histogram.field) {
            result.issues.push({
              type: 'syntax',
              severity: 'critical',
              message: `Date histogram "${aggName}" is missing a field parameter`,
              path: `aggs.${aggName}.date_histogram.field`
            });
          }
          
          // Check for either interval or calendar_interval
          if (!aggDef.date_histogram.calendar_interval && !aggDef.date_histogram.fixed_interval) {
            result.issues.push({
              type: 'syntax',
              severity: 'warning', 
              message: `Date histogram "${aggName}" should specify either calendar_interval or fixed_interval`,
              path: `aggs.${aggName}.date_histogram`
            });
          }
          break;
          
        case 'avg':
        case 'sum':
        case 'min':
        case 'max':
        case 'stats':
          if (!aggDef[aggType].field) {
            result.issues.push({
              type: 'syntax',
              severity: 'critical',
              message: `Metric aggregation "${aggName}" is missing a field parameter`,
              path: `aggs.${aggName}.${aggType}.field`
            });
          }
          break;
      }
      
      // Check for nested aggs
      if (aggDef.aggs || aggDef.aggregations) {
        const nestedAggs = aggDef.aggs || aggDef.aggregations;
        if (typeof nestedAggs !== 'object' || Object.keys(nestedAggs).length === 0) {
          result.suggestions.push({
            type: 'syntax',
            severity: 'warning',
            message: `Aggregation "${aggName}" has an empty nested aggregations definition`,
            path: `aggs.${aggName}.aggs`
          });
        }
      }
    }
  }
  
  /**
   * Validate sort order syntax
   */
  validateSortOrder(query, result) {
    if (!query.sort) return;
    
    if (!Array.isArray(query.sort)) {
      result.issues.push({
        type: 'syntax',
        severity: 'critical',
        message: 'Sort should be an array',
        path: 'sort'
      });
      return;
    }
    
    for (let i = 0; i < query.sort.length; i++) {
      const sortItem = query.sort[i];
      
      // Check for invalid sort items
      if (typeof sortItem !== 'object') {
        result.issues.push({
          type: 'syntax',
          severity: 'critical',
          message: `Sort item at position ${i} should be an object`,
          path: `sort[${i}]`
        });
        continue;
      }
      
      // Check sort field definition
      const fieldName = Object.keys(sortItem)[0];
      if (!fieldName) {
        result.issues.push({
          type: 'syntax',
          severity: 'critical',
          message: `Sort item at position ${i} is missing a field name`,
          path: `sort[${i}]`
        });
        continue;
      }
      
      // Check sort order
      const sortDef = sortItem[fieldName];
      if (sortDef && typeof sortDef === 'object') {
        if (sortDef.order && !['asc', 'desc'].includes(sortDef.order)) {
          result.issues.push({
            type: 'syntax',
            severity: 'critical',
            message: `Invalid sort order "${sortDef.order}" at position ${i}, should be "asc" or "desc"`,
            path: `sort[${i}].${fieldName}.order`
          });
        }
      }
    }
  }
  
  /**
   * Validate query semantics against schema and context
   */
  validateQuerySemantics(query, context, result) {
    // Skip semantic validation if no schema provided
    if (!context.schema || !context.schema.mappings) {
      result.suggestions.push({
        type: 'semantics',
        severity: 'info',
        message: 'Schema information not available, skipping semantic validation'
      });
      return;
    }
    
    const schema = context.schema;
    
    // Check field existence in query
    this.validateFieldsExistInSchema(query, schema, result);
    
    // Check for correct field type usage in query
    this.validateFieldTypeUsage(query, schema, result);
  }
  
  /**
   * Validate that fields referenced in the query exist in the schema
   */
  validateFieldsExistInSchema(query, schema, result) {
    // Extract all field references from the query
    const fields = this.extractFieldReferences(query);
    
    // Check each field against the schema
    for (const field of fields) {
      // Skip special fields that don't need to exist in the schema
      if (field === '_id' || field === '_source' || field === '_index' || field === '*' || field === '_all') {
        continue;
      }
      
      // Check if the field exists in the schema
      if (!this.fieldExistsInSchema(field, schema)) {
        result.issues.push({
          type: 'semantics',
          severity: 'warning',
          message: `Field "${field}" was not found in the schema`,
          path: field
        });
      }
    }
  }
  
  /**
   * Extract all field references from a query object
   */
  extractFieldReferences(obj, fields = new Set(), path = '') {
    if (!obj || typeof obj !== 'object') return fields;
    
    // Check for field references in common query structures
    if (path.includes('match') || path.includes('term') || path.includes('range')) {
      const keys = Object.keys(obj);
      for (const key of keys) {
        if (key !== 'boost' && key !== 'operator' && key !== 'fuzziness') {
          fields.add(key);
        }
      }
    }
    
    // Check for field in aggregations
    if (
      path.includes('terms') || 
      path.includes('histogram') || 
      path.includes('avg') ||
      path.includes('min') ||
      path.includes('max') ||
      path.includes('sum') ||
      path.includes('stats')
    ) {
      if (obj.field) {
        fields.add(obj.field);
      }
    }
    
    // Check for field in sort
    if (path === 'sort' && Array.isArray(obj)) {
      for (const sortItem of obj) {
        if (typeof sortItem === 'object') {
          fields.add(Object.keys(sortItem)[0]);
        }
      }
    }
    
    // Recursively check all properties
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.extractFieldReferences(obj[key], fields, newPath);
      }
    }
    
    return Array.from(fields);
  }
  
  /**
   * Check if a field exists in the schema
   */
  fieldExistsInSchema(field, schema) {
    if (!schema || !schema.mappings || !schema.mappings.properties) {
      return false;
    }
    
    // Handle nested fields
    const fieldParts = field.split('.');
    let current = schema.mappings.properties;
    
    for (let i = 0; i < fieldParts.length; i++) {
      const part = fieldParts[i];
      
      // Check for keyword suffix
      if (part.endsWith('.keyword')) {
        const textField = part.substring(0, part.length - 8);
        if (current[textField] && current[textField].type === 'text') {
          return true; // Keywords are automatically generated for text fields
        }
      }
      
      // Regular field check
      if (!current[part]) {
        return false;
      }
      
      // If this is not the last part, move to nested properties
      if (i < fieldParts.length - 1) {
        if (current[part].properties) {
          current = current[part].properties;
        } else {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Validate that fields are used with appropriate query types based on their data types
   */
  validateFieldTypeUsage(query, schema, result) {
    if (!schema || !schema.mappings || !schema.mappings.properties) {
      return;
    }
    
    const properties = schema.mappings.properties;
    
    // Check range queries
    if (query.query) {
      this.traverseQuery(query.query, (queryType, fieldName, value, path) => {
        if (queryType === 'range' && fieldName) {
          const fieldInfo = this.getFieldInfo(fieldName, properties);
          
          if (fieldInfo && !this.isFieldTypeValidForRange(fieldInfo.type)) {
            result.issues.push({
              type: 'semantics',
              severity: 'warning',
              message: `Range query used on field "${fieldName}" with type "${fieldInfo.type}" which may not support range operations`,
              path
            });
          }
        }
        
        // Check for text fields used with term query (should use match instead)
        if (queryType === 'term' && fieldName) {
          const fieldInfo = this.getFieldInfo(fieldName, properties);
          
          if (fieldInfo && fieldInfo.type === 'text') {
            result.suggestions.push({
              type: 'semantics',
              severity: 'warning',
              message: `Term query used on text field "${fieldName}". Consider using match query instead, or use the keyword field "${fieldName}.keyword"`,
              path
            });
          }
        }
        
        // Check for keyword fields used with match (could use term for better performance)
        if (queryType === 'match' && fieldName) {
          const fieldInfo = this.getFieldInfo(fieldName, properties);
          
          if (fieldInfo && fieldInfo.type === 'keyword') {
            result.suggestions.push({
              type: 'semantics',
              severity: 'info',
              message: `Match query used on keyword field "${fieldName}". Consider using term query for better performance`,
              path
            });
          }
        }
      });
    }
    
    // Check aggregations
    if (query.aggs || query.aggregations) {
      const aggs = query.aggs || query.aggregations;
      
      for (const [aggName, aggDef] of Object.entries(aggs)) {
        const aggType = Object.keys(aggDef)[0];
        
        // Check for metric aggregations on non-numeric fields
        if (['avg', 'sum', 'min', 'max', 'stats'].includes(aggType)) {
          const field = aggDef[aggType].field;
          if (field) {
            const fieldInfo = this.getFieldInfo(field, properties);
            
            if (fieldInfo && !this.isFieldTypeValidForMetric(fieldInfo.type)) {
              result.issues.push({
                type: 'semantics',
                severity: 'warning',
                message: `Metric aggregation "${aggType}" used on non-numeric field "${field}" of type "${fieldInfo.type}"`,
                path: `aggs.${aggName}.${aggType}.field`
              });
            }
          }
        }
        
        // Check for terms aggregation on text fields
        if (aggType === 'terms') {
          const field = aggDef.terms.field;
          if (field) {
            const fieldInfo = this.getFieldInfo(field, properties);
            
            if (fieldInfo && fieldInfo.type === 'text') {
              result.issues.push({
                type: 'semantics',
                severity: 'warning',
                message: `Terms aggregation used on text field "${field}". Use the keyword field "${field}.keyword" instead`,
                path: `aggs.${aggName}.terms.field`
              });
            }
          }
        }
        
        // Check for date histograms on non-date fields
        if (aggType === 'date_histogram') {
          const field = aggDef.date_histogram.field;
          if (field) {
            const fieldInfo = this.getFieldInfo(field, properties);
            
            if (fieldInfo && fieldInfo.type !== 'date') {
              result.issues.push({
                type: 'semantics',
                severity: 'warning',
                message: `Date histogram used on non-date field "${field}" of type "${fieldInfo.type}"`,
                path: `aggs.${aggName}.date_histogram.field`
              });
            }
          }
        }
      }
    }
  }
  
  /**
   * Traverse a query to find specific query types and their fields
   */
  traverseQuery(queryObj, callback, path = 'query') {
    if (!queryObj || typeof queryObj !== 'object') return;
    
    // Check for boolean queries
    if (queryObj.bool) {
      const sections = ['must', 'must_not', 'should', 'filter'];
      for (const section of sections) {
        if (Array.isArray(queryObj.bool[section])) {
          queryObj.bool[section].forEach((clause, idx) => {
            this.traverseQuery(clause, callback, `${path}.bool.${section}[${idx}]`);
          });
        }
      }
      return;
    }
    
    // Check for specific query types
    const queryTypes = Object.keys(queryObj);
    for (const queryType of queryTypes) {
      if (typeof queryObj[queryType] === 'object') {
        const fieldNames = Object.keys(queryObj[queryType]);
        
        for (const fieldName of fieldNames) {
          callback(queryType, fieldName, queryObj[queryType][fieldName], `${path}.${queryType}.${fieldName}`);
        }
      }
    }
  }
  
  /**
   * Get field info from schema properties
   */
  getFieldInfo(fieldName, properties) {
    if (!fieldName || !properties) return null;
    
    // Handle nested fields
    const fieldParts = fieldName.split('.');
    let current = properties;
    
    // Handle keyword suffix specially
    if (fieldName.endsWith('.keyword')) {
      const textField = fieldName.substring(0, fieldName.length - 8);
      const textFieldParts = textField.split('.');
      
      let nestedProps = properties;
      let found = true;
      
      for (let i = 0; i < textFieldParts.length; i++) {
        const part = textFieldParts[i];
        if (!nestedProps[part]) {
          found = false;
          break;
        }
        
        if (i < textFieldParts.length - 1) {
          if (nestedProps[part].properties) {
            nestedProps = nestedProps[part].properties;
          } else {
            found = false;
            break;
          }
        }
      }
      
      if (found) {
        const lastPart = textFieldParts[textFieldParts.length - 1];
        if (nestedProps[lastPart] && nestedProps[lastPart].type === 'text') {
          return { type: 'keyword' }; // .keyword fields are keyword type
        }
      }
    }
    
    // Regular field traversal
    for (let i = 0; i < fieldParts.length; i++) {
      const part = fieldParts[i];
      
      if (!current[part]) {
        return null;
      }
      
      if (i === fieldParts.length - 1) {
        return current[part];
      }
      
      if (current[part].properties) {
        current = current[part].properties;
      } else {
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Check if field type is valid for range queries
   */
  isFieldTypeValidForRange(fieldType) {
    return ['long', 'integer', 'short', 'byte', 'double', 'float', 'date', 'ip'].includes(fieldType);
  }
  
  /**
   * Check if field type is valid for metric aggregations
   */
  isFieldTypeValidForMetric(fieldType) {
    return ['long', 'integer', 'short', 'byte', 'double', 'float'].includes(fieldType);
  }
  
  /**
   * Validate best practices for Elasticsearch queries
   */
  validateBestPractices(query, result) {
    // Check for lack of pagination in large result sets
    if ((query.size > 10000 || (query.size > 1000 && !query.sort))) {
      result.suggestions.push({
        type: 'performance',
        severity: 'warning',
        message: `Large result size (${query.size}) requested without proper pagination may cause performance issues`,
        path: 'size'
      });
    }
    
    // Check for excessive nesting of boolean queries
    this.checkBooleanNesting(query.query, result);
    
    // Check for fielddata usage on text fields in aggregations
    if (query.aggs || query.aggregations) {
      const aggs = query.aggs || query.aggregations;
      for (const [aggName, aggDef] of Object.entries(aggs)) {
        if (aggDef.terms && aggDef.terms.field && !aggDef.terms.field.includes('keyword') &&
            aggDef.terms.fielddata === true) {
          result.suggestions.push({
            type: 'performance',
            severity: 'warning',
            message: `Using fielddata on text field "${aggDef.terms.field}" can be memory intensive. Consider using a keyword field instead.`,
            path: `aggs.${aggName}.terms`
          });
        }
      }
    }
    
    // Check for wildcard prefix queries
    this.checkWildcardPrefixes(query, result);
  }
  
  /**
   * Check for excessive nesting of boolean queries
   */
  checkBooleanNesting(queryObj, result, depth = 0, path = 'query') {
    if (!queryObj || typeof queryObj !== 'object') return;
    
    if (queryObj.bool) {
      depth++;
      
      // Warning about excessive boolean nesting
      if (depth > 3) {
        result.suggestions.push({
          type: 'performance',
          severity: 'warning',
          message: `Deep nesting of boolean queries (depth: ${depth}) can impact performance`,
          path
        });
      }
      
      // Check sections
      const sections = ['must', 'must_not', 'should', 'filter'];
      for (const section of sections) {
        if (Array.isArray(queryObj.bool[section])) {
          queryObj.bool[section].forEach((clause, idx) => {
            this.checkBooleanNesting(clause, result, depth, `${path}.bool.${section}[${idx}]`);
          });
        }
      }
    }
    
    // Check other query types for nested boolean queries
    for (const key in queryObj) {
      if (key !== 'bool' && typeof queryObj[key] === 'object' && queryObj[key] !== null) {
        this.checkBooleanNesting(queryObj[key], result, depth, `${path}.${key}`);
      }
    }
  }
  
  /**
   * Check for wildcard queries with leading wildcards
   */
  checkWildcardPrefixes(query, result) {
    this.traverseQuery(query.query, (queryType, fieldName, value, path) => {
      if (queryType === 'wildcard' || queryType === 'regexp') {
        const wildcardValue = queryType === 'wildcard' ? value : value.value;
        
        if (typeof wildcardValue === 'string' && (wildcardValue.startsWith('*') || wildcardValue.startsWith('?'))) {
          result.suggestions.push({
            type: 'performance',
            severity: 'warning',
            message: `Leading wildcard in ${queryType} query for field "${fieldName}" can be very slow`,
            path
          });
        }
      }
    });
  }
  
  /**
   * Attempt to fix common issues in a query
   */
  attemptQueryFix(query, issues) {
    // Create a deep copy of the query to avoid modifying the original
    const fixedQuery = JSON.parse(JSON.stringify(query));
    
    for (const issue of issues) {
      // Skip non-critical issues
      if (issue.severity !== 'critical') continue;
      
      // Fix syntax issues based on path
      if (issue.path) {
        const pathParts = issue.path.split('.');
        let current = fixedQuery;
        let parent = null;
        let lastKey = null;
        
        // Navigate to the issue location
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          
          // Handle array indices
          if (part.includes('[') && part.includes(']')) {
            const match = part.match(/([^\[]+)\[(\d+)\]/);
            if (match) {
              const arrayName = match[1];
              const index = parseInt(match[2]);
              
              if (!current[arrayName] || !Array.isArray(current[arrayName])) {
                current[arrayName] = [];
              }
              
              parent = current;
              lastKey = arrayName;
              current = current[arrayName][index] = current[arrayName][index] || {};
            }
          } else {
            // Regular object property
            if (i === pathParts.length - 1) {
              parent = current;
              lastKey = part;
            } else {
              if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
              }
              parent = current;
              lastKey = part;
              current = current[part];
            }
          }
        }
        
        // Apply fixes based on issue type
        if (issue.message.includes('should be an array')) {
          parent[lastKey] = Array.isArray(parent[lastKey]) ? parent[lastKey] : [];
        }
        else if (issue.message.includes('missing a field parameter') && lastKey === 'field') {
          // Fix missing field in aggregation
          parent.field = 'unknown_field'; // Placeholder to fix syntax
        }
        else if (issue.message.includes('Sort should be an array')) {
          fixedQuery.sort = Array.isArray(fixedQuery.sort) ? fixedQuery.sort : [];
        }
      }
    }
    
    // Fix bool query with should clauses but no minimum_should_match
    if (
      fixedQuery.query &&
      fixedQuery.query.bool &&
      fixedQuery.query.bool.should &&
      fixedQuery.query.bool.should.length > 0 &&
      (!fixedQuery.query.bool.must || fixedQuery.query.bool.must.length === 0) &&
      (!fixedQuery.query.bool.filter || fixedQuery.query.bool.filter.length === 0) &&
      fixedQuery.query.bool.minimum_should_match === undefined
    ) {
      fixedQuery.query.bool.minimum_should_match = 1;
    }
    
    return fixedQuery;
  }
}

export default ValidationTool;
