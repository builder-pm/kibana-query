// src/services/SchemaManager.js

/**
 * SchemaManager
 * 
 * Service for discovering, managing and caching Elasticsearch index schemas.
 * This provides optimized schema information for query generation.
 */
class SchemaManager {
  constructor() {
    this.schemaCache = new Map();
    this.cacheExpiry = new Map(); // Track expiry time for each schema
    this.cacheTTL = 3600000; // Default 1 hour TTL for schema cache
  }

  /**
   * Get schema for a specific cluster and index pattern
   * @param {string} clusterId - The ID of the ES cluster
   * @param {string} indexPattern - The index pattern (e.g. "logs-*")
   * @returns {Promise<Object>} - The schema object with mappings and analysis
   */
  async getSchema(clusterId, indexPattern) {
    const cacheKey = `${clusterId}:${indexPattern}`;
    
    // Check if we have a fresh cached schema
    if (this.hasValidCache(cacheKey)) {
      return this.schemaCache.get(cacheKey);
    }
    
    // Discover schema
    try {
      const schema = await this.discoverSchema(clusterId, indexPattern);
      this.cacheSchema(cacheKey, schema);
      return schema;
    } catch (error) {
      console.error(`Error fetching schema for ${indexPattern} on cluster ${clusterId}:`, error);
      
      // If cache exists but expired, return stale cache rather than failing
      if (this.schemaCache.has(cacheKey)) {
        console.warn(`Returning stale schema for ${indexPattern} as fallback`);
        return this.schemaCache.get(cacheKey);
      }
      
      throw error;
    }
  }

  /**
   * Check if we have a valid (non-expired) cache for a schema
   */
  hasValidCache(cacheKey) {
    if (!this.schemaCache.has(cacheKey)) return false;
    
    const expiry = this.cacheExpiry.get(cacheKey) || 0;
    return Date.now() < expiry;
  }

  /**
   * Cache a schema with the current TTL
   */
  cacheSchema(cacheKey, schema) {
    this.schemaCache.set(cacheKey, schema);
    this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTTL);
  }

  /**
   * Discover schema from Elasticsearch cluster
   */
  async discoverSchema(clusterId, indexPattern) {
    // Get the ES client through the ESClusterManager
    // This is a placeholder - in a real implementation, we would import and use ESClusterManager
    // For demo purposes, we're using a fake client
    const client = await this.getESClient(clusterId);
    
    // If no client found or we're in demo mode, use a mock schema
    if (!client) {
      console.warn(`No client available for cluster ${clusterId}, using mock schema`);
      return this.getMockSchema(indexPattern);
    }
    
    try {
      // Get indices matching the pattern
      const indicesResponse = await client.indices.get({
        index: indexPattern,
        include_type_name: false
      });
      
      // If no indices found, throw error
      if (!indicesResponse || Object.keys(indicesResponse).length === 0) {
        throw new Error(`No indices found matching pattern ${indexPattern}`);
      }
      
      // Get the first index to serve as the representative schema
      const indexName = Object.keys(indicesResponse)[0];
      const indexInfo = indicesResponse[indexName];
      
      // Get mappings and other metadata
      const schema = {
        mappings: indexInfo.mappings,
        settings: indexInfo.settings,
        analysis: this.analyzeSchema(indexInfo.mappings),
        lastUpdated: new Date(),
        version: indexInfo.settings?.index?.version?.created || 'unknown'
      };
      
      return schema;
    } catch (error) {
      console.error('Error discovering schema:', error);
      throw error;
    }
  }

  /**
   * Analyze schema to identify field types and important fields
   */
  analyzeSchema(mappings) {
    // Initialize analysis object
    const analysis = {
      searchableFields: [],     // Fields good for text search
      aggregatableFields: [],   // Fields good for aggregations
      dateFields: [],           // Date fields
      geoFields: [],            // Geographic fields
      nestedFields: [],         // Fields with nested objects
      suggestions: []           // Schema-based query suggestions
    };
    
    // Process the properties if they exist
    if (mappings?.properties) {
      this.analyzeFields(mappings.properties, '', analysis);
    }
    
    // Generate suggestions based on field analysis
    this.generateSchemaSuggestions(analysis);
    
    return analysis;
  }

  /**
   * Helper to recursively analyze fields in schema
   */
  analyzeFields(properties, prefix, analysis) {
    for (const [fieldName, fieldMapping] of Object.entries(properties)) {
      const fullPath = prefix ? `${prefix}.${fieldName}` : fieldName;
      
      // Handle field based on type
      if (fieldMapping.type) {
        switch (fieldMapping.type) {
          case 'text':
            analysis.searchableFields.push(fullPath);
            // If field has keyword sub-field, add it to aggregatableFields
            if (fieldMapping.fields && fieldMapping.fields.keyword) {
              analysis.aggregatableFields.push(`${fullPath}.keyword`);
            }
            break;
            
          case 'keyword':
            analysis.aggregatableFields.push(fullPath);
            break;
            
          case 'date':
            analysis.dateFields.push(fullPath);
            analysis.aggregatableFields.push(fullPath);
            break;
            
          case 'geo_point':
          case 'geo_shape':
            analysis.geoFields.push(fullPath);
            break;
            
          case 'nested':
            analysis.nestedFields.push(fullPath);
            break;
            
          case 'long':
          case 'integer':
          case 'short':
          case 'byte':
          case 'double':
          case 'float':
          case 'half_float':
          case 'scaled_float':
            analysis.aggregatableFields.push(fullPath);
            break;
        }
      }
      
      // Recurse into nested properties
      if (fieldMapping.properties) {
        this.analyzeFields(fieldMapping.properties, fullPath, analysis);
      }
    }
  }

  /**
   * Generate helpful query suggestions based on schema analysis
   */
  generateSchemaSuggestions(analysis) {
    // Add suggestions based on available fields
    
    // Search suggestions
    if (analysis.searchableFields.length > 0) {
      const exampleField = analysis.searchableFields[0];
      analysis.suggestions.push({
        type: 'search',
        description: `Try searching in the ${exampleField} field`,
        example: `"Find documents where ${exampleField} contains 'search term'"`
      });
    }
    
    // Aggregation suggestions
    if (analysis.aggregatableFields.length > 0) {
      const exampleField = analysis.aggregatableFields[0];
      analysis.suggestions.push({
        type: 'aggregation',
        description: `You can aggregate by ${exampleField}`,
        example: `"Show me the count of documents by ${exampleField}"`
      });
    }
    
    // Date field suggestions
    if (analysis.dateFields.length > 0) {
      const exampleField = analysis.dateFields[0];
      analysis.suggestions.push({
        type: 'date',
        description: `Filter by date using ${exampleField}`,
        example: `"Show me documents from last week based on ${exampleField}"`
      });
      
      // Time series suggestion
      analysis.suggestions.push({
        type: 'timeseries',
        description: `Create a time series analysis using ${exampleField}`,
        example: `"Show me trends over time using ${exampleField} with daily intervals"`
      });
    }
    
    // Geo field suggestions
    if (analysis.geoFields.length > 0) {
      const exampleField = analysis.geoFields[0];
      analysis.suggestions.push({
        type: 'geo',
        description: `Filter by geographic location using ${exampleField}`,
        example: `"Find documents within 10km of latitude 40.7, longitude -74.0 using ${exampleField}"`
      });
    }
  }

  /**
   * Clear the schema cache for a specific cluster or all clusters
   */
  clearCache(clusterId = null) {
    if (clusterId) {
      // Clear specific cluster entries
      for (const key of this.schemaCache.keys()) {
        if (key.startsWith(`${clusterId}:`)) {
          this.schemaCache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.schemaCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get an Elasticsearch client for a given cluster
   * This is a placeholder that would normally interact with ESClusterManager
   */
  async getESClient(clusterId) {
    // For demo purposes, we'll return null to force using mock schema
    // In a real implementation, this would get a client from ESClusterManager
    return null;
  }

  /**
   * Get a mock schema for demo purposes when no connection is available
   */
  getMockSchema(indexPattern) {
    // Different mock schemas for different index patterns
    let mockSchema;
    
    if (indexPattern.includes('logs')) {
      mockSchema = this.getMockLogsSchema();
    } else if (indexPattern.includes('metrics')) {
      mockSchema = this.getMockMetricsSchema();
    } else if (indexPattern.includes('users')) {
      mockSchema = this.getMockUsersSchema();
    } else {
      mockSchema = this.getMockDefaultSchema();
    }
    
    return {
      ...mockSchema,
      lastUpdated: new Date(),
      version: '7.10.0'
    };
  }

  /**
   * Get mock schema for log data
   */
  getMockLogsSchema() {
    const mappings = {
      properties: {
        '@timestamp': { type: 'date' },
        'message': { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
        'log.level': { type: 'keyword' },
        'log.logger': { type: 'keyword' },
        'service.name': { type: 'keyword' },
        'service.version': { type: 'keyword' },
        'host.name': { type: 'keyword' },
        'host.ip': { type: 'ip' },
        'http.request.method': { type: 'keyword' },
        'http.request.body.content': { type: 'text' },
        'http.response.status_code': { type: 'integer' },
        'http.response.body.content': { type: 'text' },
        'event.duration': { type: 'long' },
        'user.id': { type: 'keyword' },
        'error': {
          properties: {
            'message': { type: 'text' },
            'type': { type: 'keyword' },
            'stack_trace': { type: 'text' }
          }
        },
        'labels': {
          properties: {
            'env': { type: 'keyword' },
            'version': { type: 'keyword' }
          }
        },
        'geo': {
          properties: {
            'coordinates': { type: 'geo_point' }
          }
        }
      }
    };

    // Analyze schema to get field info
    const analysis = this.analyzeSchema(mappings);
    
    return {
      mappings,
      settings: {
        index: {
          number_of_shards: '1',
          number_of_replicas: '1',
          creation_date: '1609459200000',
          provided_name: 'logs-2021.01.01',
          uuid: '1234abcd5678efgh',
          version: { created: '7100099' }
        }
      },
      analysis
    };
  }

  /**
   * Get mock schema for metrics data
   */
  getMockMetricsSchema() {
    const mappings = {
      properties: {
        '@timestamp': { type: 'date' },
        'host.name': { type: 'keyword' },
        'service.name': { type: 'keyword' },
        'metricset.name': { type: 'keyword' },
        'metricset.period': { type: 'integer' },
        'system.cpu': {
          properties: {
            'total.pct': { type: 'float' },
            'user.pct': { type: 'float' },
            'system.pct': { type: 'float' },
            'cores': { type: 'integer' }
          }
        },
        'system.memory': {
          properties: {
            'total': { type: 'long' },
            'used.bytes': { type: 'long' },
            'used.pct': { type: 'float' },
            'free': { type: 'long' }
          }
        },
        'system.network': {
          properties: {
            'name': { type: 'keyword' },
            'in.bytes': { type: 'long' },
            'out.bytes': { type: 'long' },
            'in.packets': { type: 'long' },
            'out.packets': { type: 'long' }
          }
        },
        'system.filesystem': {
          properties: {
            'mount_point': { type: 'keyword' },
            'device_name': { type: 'keyword' },
            'total': { type: 'long' },
            'used.bytes': { type: 'long' },
            'used.pct': { type: 'float' }
          }
        }
      }
    };

    // Analyze schema to get field info
    const analysis = this.analyzeSchema(mappings);
    
    return {
      mappings,
      settings: {
        index: {
          number_of_shards: '1',
          number_of_replicas: '1',
          creation_date: '1609459200000',
          provided_name: 'metrics-2021.01.01',
          uuid: '5678efgh1234abcd',
          version: { created: '7100099' }
        }
      },
      analysis
    };
  }

  /**
   * Get mock schema for user data
   */
  getMockUsersSchema() {
    const mappings = {
      properties: {
        'id': { type: 'keyword' },
        'username': { type: 'keyword' },
        'email': { type: 'keyword' },
        'name': { 
          properties: {
            'first': { type: 'text', fields: { keyword: { type: 'keyword' } } },
            'last': { type: 'text', fields: { keyword: { type: 'keyword' } } }
          }
        },
        'created_at': { type: 'date' },
        'updated_at': { type: 'date' },
        'last_login': { type: 'date' },
        'profile': {
          properties: {
            'bio': { type: 'text' },
            'company': { type: 'keyword' },
            'location': { type: 'text', fields: { keyword: { type: 'keyword' } } },
            'website': { type: 'keyword' },
            'avatar_url': { type: 'keyword' }
          }
        },
        'preferences': {
          properties: {
            'theme': { type: 'keyword' },
            'notifications': { type: 'boolean' },
            'language': { type: 'keyword' }
          }
        },
        'stats': {
          properties: {
            'followers': { type: 'integer' },
            'following': { type: 'integer' },
            'posts': { type: 'integer' },
            'reputation': { type: 'float' }
          }
        },
        'location': { type: 'geo_point' },
        'tags': { type: 'keyword' },
        'active': { type: 'boolean' }
      }
    };

    // Analyze schema to get field info
    const analysis = this.analyzeSchema(mappings);
    
    return {
      mappings,
      settings: {
        index: {
          number_of_shards: '1',
          number_of_replicas: '1',
          creation_date: '1609459200000',
          provided_name: 'users',
          uuid: 'abcdef1234567890',
          version: { created: '7100099' }
        }
      },
      analysis
    };
  }

  /**
   * Get a generic mock schema for any other index patterns
   */
  getMockDefaultSchema() {
    const mappings = {
      properties: {
        'id': { type: 'keyword' },
        'name': { type: 'text', fields: { keyword: { type: 'keyword' } } },
        'description': { type: 'text' },
        'created_at': { type: 'date' },
        'updated_at': { type: 'date' },
        'type': { type: 'keyword' },
        'status': { type: 'keyword' },
        'tags': { type: 'keyword' },
        'category': { type: 'keyword' },
        'count': { type: 'integer' },
        'value': { type: 'float' },
        'enabled': { type: 'boolean' },
        'metadata': {
          properties: {
            'version': { type: 'keyword' },
            'source': { type: 'keyword' }
          }
        }
      }
    };

    // Analyze schema to get field info
    const analysis = this.analyzeSchema(mappings);
    
    return {
      mappings,
      settings: {
        index: {
          number_of_shards: '1',
          number_of_replicas: '1',
          creation_date: '1609459200000',
          provided_name: 'default-index',
          uuid: '1234567890abcdef',
          version: { created: '7100099' }
        }
      },
      analysis
    };
  }
}

export default SchemaManager;