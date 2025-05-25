// src/agent/elasticsearch/ESToolManager.ts

/**
 * ESToolManager
 * 
 * Manages Elasticsearch-specific tools and operations for the BrowserBee agent.
 * Provides methods for query validation, execution, and schema discovery.
 */
export class ESToolManager {
  private activeCluster: string | null = null;
  private clusterClients: Map<string, any> = new Map();

  constructor() {
    console.log('ESToolManager initialized');
  }

  /**
   * Set the active Elasticsearch cluster
   */
  async setActiveCluster(clusterId: string): Promise<void> {
    this.activeCluster = clusterId;
    
    // Initialize client if not already done
    if (!this.clusterClients.has(clusterId)) {
      await this.initializeClusterClient(clusterId);
    }
  }

  /**
   * Initialize client for a cluster
   */
  private async initializeClusterClient(clusterId: string): Promise<void> {
    try {
      // In a real implementation, this would create an Elasticsearch client
      // For now, we'll use a mock client for demonstration
      const mockClient = {
        search: async (params: any) => ({ body: { hits: { hits: [] } } }),
        indices: {
          get: async (params: any) => ({ [params.index]: { mappings: {} } }),
          getMapping: async (params: any) => ({ [params.index]: { mappings: {} } })
        },
        cluster: {
          health: async () => ({ status: 'green', cluster_name: 'test-cluster' })
        }
      };
      
      this.clusterClients.set(clusterId, mockClient);
      console.log(`Client initialized for cluster: ${clusterId}`);
    } catch (error) {
      console.error(`Failed to initialize client for cluster ${clusterId}:`, error);
      throw error;
    }
  }

  /**
   * Parse and validate a query from LLM output
   */
  async parseAndValidateQuery(llmOutput: string): Promise<any> {
    try {
      // Extract JSON from LLM output
      const jsonMatch = llmOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (!jsonMatch) {
        throw new Error('No valid JSON query found in LLM output');
      }

      const queryObject = JSON.parse(jsonMatch[1]);
      
      // Validate the query structure
      const validation = await this.validateQuery(queryObject);
      if (!validation.valid) {
        throw new Error(`Invalid query: ${validation.errors?.join(', ')}`);
      }

      return {
        query: queryObject,
        explanation: this.extractExplanation(llmOutput),
        valid: true
      };
    } catch (error) {
      console.error('Error parsing query:', error);
      throw error;
    }
  }

  /**
   * Execute an Elasticsearch query
   */
  async executeQuery(query: object): Promise<any> {
    if (!this.activeCluster) {
      throw new Error('No active cluster set');
    }

    const client = this.clusterClients.get(this.activeCluster);
    if (!client) {
      throw new Error(`No client available for cluster: ${this.activeCluster}`);
    }

    try {
      const result = await client.search(query);
      return {
        hits: result.body?.hits || { hits: [] },
        took: result.body?.took || 0,
        timed_out: result.body?.timed_out || false,
        _shards: result.body?._shards || {}
      };
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  /**
   * Validate an Elasticsearch query
   */
  async validateQuery(query: object): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    try {
      // Basic structure validation
      if (!query || typeof query !== 'object') {
        errors.push('Query must be an object');
        return { valid: false, errors };
      }

      // Check for required fields based on query type
      if ('query' in query) {
        // It's a search query
        if (!this.isValidQueryDSL(query.query)) {
          errors.push('Invalid query DSL structure');
        }
      }

      if ('aggs' in query || 'aggregations' in query) {
        // Has aggregations - validate them
        const aggs = query.aggs || query.aggregations;
        if (!this.isValidAggregations(aggs)) {
          errors.push('Invalid aggregations structure');
        }
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Get schema information for an index pattern
   */
  async getSchemaInfo(indexPattern: string = '*'): Promise<any> {
    if (!this.activeCluster) {
      throw new Error('No active cluster set');
    }

    const client = this.clusterClients.get(this.activeCluster);
    if (!client) {
      throw new Error(`No client available for cluster: ${this.activeCluster}`);
    }

    try {
      const mappings = await client.indices.getMapping({ index: indexPattern });
      return this.processSchemaInfo(mappings);
    } catch (error) {
      console.error('Error getting schema info:', error);
      // Return mock schema for demonstration
      return this.getMockSchema(indexPattern);
    }
  }

  /**
   * Extract explanation from LLM output
   */
  private extractExplanation(llmOutput: string): string {
    // Look for explanation before the JSON block
    const parts = llmOutput.split('```');
    if (parts.length > 0) {
      return parts[0].trim();
    }
    return 'Query generated successfully';
  }

  /**
   * Validate Query DSL structure
   */
  private isValidQueryDSL(queryDSL: any): boolean {
    if (!queryDSL || typeof queryDSL !== 'object') return false;
    
    const validQueryTypes = [
      'match', 'match_all', 'term', 'terms', 'range', 'bool', 
      'multi_match', 'query_string', 'simple_query_string',
      'wildcard', 'prefix', 'fuzzy', 'regexp'
    ];

    return validQueryTypes.some(type => type in queryDSL);
  }

  /**
   * Validate aggregations structure
   */
  private isValidAggregations(aggs: any): boolean {
    if (!aggs || typeof aggs !== 'object') return false;
    
    // Basic validation - check if at least one aggregation is defined
    return Object.keys(aggs).length > 0;
  }

  /**
   * Process schema information from Elasticsearch mappings
   */
  private processSchemaInfo(mappings: any): any {
    const processed = {
      indices: {},
      fields: new Set(),
      fieldTypes: {}
    };

    for (const [indexName, indexData] of Object.entries(mappings)) {
      const mappingData = indexData.mappings || {};
      const properties = mappingData.properties || {};
      
      processed.indices[indexName] = properties;
      
      // Extract field information
      this.extractFields(properties, processed.fields, processed.fieldTypes);
    }

    return {
      ...processed,
      fields: Array.from(processed.fields)
    };
  }

  /**
   * Extract fields recursively from mappings
   */
  private extractFields(properties: any, fields: Set<string>, fieldTypes: any, prefix = ''): void {
    for (const [fieldName, fieldConfig] of Object.entries(properties)) {
      const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;
      fields.add(fullFieldName);
      
      if (fieldConfig.type) {
        fieldTypes[fullFieldName] = fieldConfig.type;
      }
      
      if (fieldConfig.properties) {
        this.extractFields(fieldConfig.properties, fields, fieldTypes, fullFieldName);
      }
    }
  }

  /**
   * Get mock schema for demonstration
   */
  private getMockSchema(indexPattern: string): any {
    return {
      indices: {
        [indexPattern]: {
          '@timestamp': { type: 'date' },
          'message': { type: 'text' },
          'level': { type: 'keyword' },
          'user.name': { type: 'keyword' },
          'user.id': { type: 'long' },
          'response_time': { type: 'double' },
          'status_code': { type: 'integer' }
        }
      },
      fields: ['@timestamp', 'message', 'level', 'user.name', 'user.id', 'response_time', 'status_code'],
      fieldTypes: {
        '@timestamp': 'date',
        'message': 'text',
        'level': 'keyword',
        'user.name': 'keyword',
        'user.id': 'long',
        'response_time': 'double',
        'status_code': 'integer'
      }
    };
  }
}