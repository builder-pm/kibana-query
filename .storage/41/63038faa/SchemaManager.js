// src/services/SchemaManager.js
class SchemaManager {
  constructor() {
    this.schemaCache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get the schema for a specific cluster and index pattern
   * @param {string} clusterId - Cluster ID
   * @param {string} indexPattern - Index pattern to discover
   * @returns {Promise<Object>} - Schema information
   */
  async getSchema(clusterId, indexPattern = '*') {
    const cacheKey = `${clusterId}_${indexPattern}`;
    const cached = this.schemaCache.get(cacheKey);
    
    // Return cached schema if valid
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }
    
    // Otherwise discover schema
    try {
      return await this.discoverSchema(clusterId, indexPattern);
    } catch (error) {
      console.error('Failed to get schema:', error);
      throw new Error(`Failed to get schema: ${error.message}`);
    }
  }

  /**
   * Check if cached schema is still valid
   * @param {Object} schema - Cached schema
   * @returns {boolean} - True if cache is valid
   */
  isCacheValid(schema) {
    if (!schema || !schema.lastUpdated) {
      return false;
    }
    
    const now = new Date();
    const cacheAge = now.getTime() - schema.lastUpdated.getTime();
    
    return cacheAge < this.cacheTimeout;
  }

  /**
   * Discover the schema for a cluster and index pattern
   * @param {string} clusterId - Cluster ID
   * @param {string} indexPattern - Index pattern to discover
   * @returns {Promise<Object>} - Schema information
   */
  async discoverSchema(clusterId, indexPattern = '*') {
    const cacheKey = `${clusterId}_${indexPattern}`;
    
    try {
      // In a real implementation, this would:
      // 1. Get the cluster configuration
      // 2. Create an ES client
      // 3. Call the ES API to get mappings and settings
      // 4. Process and analyze the schema
      
      // For demo purposes, we'll just return mock data
      const mockSchema = this.createMockSchema(indexPattern);
      
      // Cache the schema
      this.schemaCache.set(cacheKey, mockSchema);
      
      return mockSchema;
    } catch (error) {
      console.error('Schema discovery failed:', error);
      throw new Error(`Schema discovery failed: ${error.message}`);
    }
  }

  /**
   * Clear the schema cache for a specific cluster and index pattern
   * @param {string} clusterId - Cluster ID
   * @param {string} indexPattern - Index pattern
   * @returns {boolean} - True if cache was cleared
   */
  clearCache(clusterId, indexPattern = '*') {
    const cacheKey = `${clusterId}_${indexPattern}`;
    return this.schemaCache.delete(cacheKey);
  }

  /**
   * Clear all schema caches
   */
  clearAllCaches() {
    this.schemaCache.clear();
  }

  /**
   * Create a mock schema for demonstration purposes
   * @param {string} indexPattern - Index pattern
   * @returns {Object} - Mock schema
   */
  createMockSchema(indexPattern) {
    let mappings;
    
    if (indexPattern.includes('job') || indexPattern === '*') {
      // Mock schema for a jobs index
      mappings = {
        properties: {
          title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          company: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          description: { type: 'text' },
          requirements: { type: 'text' },
          salary: { type: 'integer' },
          location: {
            properties: {
              city: { type: 'keyword' },
              country: { type: 'keyword' },
              geo: { type: 'geo_point' }
            }
          },
          date_posted: { type: 'date' },
          experience_level: { type: 'keyword' },
          job_type: { type: 'keyword' },
          tags: { type: 'keyword' },
          status: { type: 'keyword' }
        }
      };
    } else if (indexPattern.includes('product') || indexPattern.includes('ecommerce')) {
      // Mock schema for a products index
      mappings = {
        properties: {
          name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          description: { type: 'text' },
          price: { type: 'float' },
          category: { type: 'keyword' },
          brand: { type: 'keyword' },
          sku: { type: 'keyword' },
          inventory: { type: 'integer' },
          tags: { type: 'keyword' },
          created_at: { type: 'date' },
          updated_at: { type: 'date' }
        }
      };
    } else if (indexPattern.includes('log')) {
      // Mock schema for a logs index
      mappings = {
        properties: {
          timestamp: { type: 'date' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          logger_name: { type: 'keyword' },
          thread_name: { type: 'keyword' },
          service: { type: 'keyword' },
          trace_id: { type: 'keyword' },
          span_id: { type: 'keyword' },
          exception: { type: 'text' },
          stack_trace: { type: 'text' }
        }
      };
    } else {
      // Generic schema for other indices
      mappings = {
        properties: {
          id: { type: 'keyword' },
          title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          description: { type: 'text' },
          timestamp: { type: 'date' },
          tags: { type: 'keyword' }
        }
      };
    }
    
    return {
      mappings,
      analysis: {
        searchableFields: this.extractFieldsByType(mappings, 'text'),
        aggregatableFields: this.extractFieldsByType(mappings, 'keyword'),
        dateFields: this.extractFieldsByType(mappings, 'date'),
        geoFields: this.extractFieldsByType(mappings, 'geo_point'),
        nestedFields: this.extractNestedFields(mappings)
      },
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Extract fields of a specific type from mappings
   * @param {Object} mappings - Elasticsearch mappings object
   * @param {string} fieldType - Field type to extract
   * @returns {Array<string>} - List of field names
   */
  extractFieldsByType(mappings, fieldType) {
    const fields = [];
    
    const traverse = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.type === fieldType) {
        fields.push(path);
        return;
      }
      
      if (obj.properties) {
        Object.keys(obj.properties).forEach(key => {
          const newPath = path ? `${path}.${key}` : key;
          traverse(obj.properties[key], newPath);
        });
        return;
      }
      
      // Handle fields with multi-fields
      if (obj.fields) {
        Object.keys(obj.fields).forEach(key => {
          if (obj.fields[key].type === fieldType) {
            const newPath = path ? `${path}.${key}` : key;
            fields.push(newPath);
          }
        });
      }
    };
    
    traverse(mappings);
    return fields;
  }

  /**
   * Extract nested fields from mappings
   * @param {Object} mappings - Elasticsearch mappings object
   * @returns {Array<string>} - List of nested field paths
   */
  extractNestedFields(mappings) {
    const fields = [];
    
    const traverse = (obj, path = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.type === 'nested') {
        fields.push(path);
      }
      
      if (obj.properties) {
        Object.keys(obj.properties).forEach(key => {
          const newPath = path ? `${path}.${key}` : key;
          traverse(obj.properties[key], newPath);
        });
      }
    };
    
    traverse(mappings);
    return fields;
  }
}

// Export a singleton instance
export default new SchemaManager();
