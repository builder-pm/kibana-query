import { ESConnectionManager } from './ESConnectionManager';
import { ESClusterConfig, ESSchema, SchemaAnalysis, SchemaField } from './types';

// Default cache Time-To-Live: 1 hour
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; 

export class ESSchemaManager {
  private schemaCache: Map<string, ESSchema>;
  private cacheExpiry: Map<string, number>;
  private cacheTTL: number;

  constructor(private esConnectionManager: ESConnectionManager, cacheTTL: number = DEFAULT_CACHE_TTL) {
    if (!esConnectionManager) {
        throw new Error("ESConnectionManager is required for ESSchemaManager.");
    }
    this.schemaCache = new Map();
    this.cacheExpiry = new Map();
    this.cacheTTL = cacheTTL;
    console.log("ESSchemaManager initialized.");
  }

  private _getCacheKey(clusterId: string, indexPattern: string): string {
    return `${clusterId}_${indexPattern}`;
  }

  hasValidCache(cacheKey: string): boolean {
    return this.schemaCache.has(cacheKey) && (this.cacheExpiry.get(cacheKey) || 0) > Date.now();
  }

  cacheSchema(cacheKey: string, schema: ESSchema): void {
    this.schemaCache.set(cacheKey, schema);
    this.cacheExpiry.set(cacheKey, Date.now() + this.cacheTTL);
    console.log(`Schema cached for key: ${cacheKey}`);
  }

  clearCache(clusterId?: string, indexPattern?: string): void {
    if (clusterId && indexPattern) {
      const cacheKey = this._getCacheKey(clusterId, indexPattern);
      this.schemaCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      console.log(`Cache cleared for key: ${cacheKey}`);
    } else if (clusterId) {
      this.schemaCache.forEach((_, key) => {
        if (key.startsWith(`${clusterId}_`)) {
          this.schemaCache.delete(key);
          this.cacheExpiry.delete(key);
        }
      });
      console.log(`Cache cleared for cluster ID: ${clusterId}`);
    } else {
      this.schemaCache.clear();
      this.cacheExpiry.clear();
      console.log('All schema cache cleared.');
    }
  }

  public async getSchema(clusterId: string, indexPattern: string): Promise<ESSchema> {
    const cacheKey = this._getCacheKey(clusterId, indexPattern);
    if (this.hasValidCache(cacheKey)) {
      console.log(`Returning cached schema for key: ${cacheKey}`);
      const cachedSchema = this.schemaCache.get(cacheKey)!;
      return { ...cachedSchema, source: 'cache' };
    }

    try {
      console.log(`Attempting to discover schema for key: ${cacheKey}`);
      const discoveredSchema = await this.discoverSchema(clusterId, indexPattern);
      this.cacheSchema(cacheKey, discoveredSchema);
      return { ...discoveredSchema, source: 'discovery' };
    } catch (error: any) {
      console.error(`Failed to discover schema for ${cacheKey}: ${error.message}.`);
      if (this.schemaCache.has(cacheKey)) { 
        console.warn(`Using stale cache for key: ${cacheKey}`);
        const staleSchema = this.schemaCache.get(cacheKey)!;
        return { ...staleSchema, source: 'cache' }; 
      }
      console.warn(`Falling back to mock schema for key: ${cacheKey} due to discovery error and no cache.`);
      const mockSchema = this.getMockDefaultSchema(indexPattern); 
      this.cacheSchema(cacheKey, mockSchema); 
      return { ...mockSchema, source: 'mock' };
    }
  }

  public async discoverSchema(clusterId: string, indexPattern: string): Promise<ESSchema> {
    const activeClusterConfig = await this.esConnectionManager.getCluster(clusterId);
    if (!activeClusterConfig) {
      throw new Error(`Cluster configuration not found for ID: ${clusterId}. Cannot discover schema.`);
    }

    const { protocol, host, port, auth } = activeClusterConfig;
    const url = `${protocol}://${host}:${port}/${encodeURIComponent(indexPattern)}/_mapping`;
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      mode: 'cors',
    };

    if (auth) {
      if (auth.type === 'basic' && auth.username && auth.password) {
        (requestOptions.headers as Headers).set('Authorization', 'Basic ' + btoa(`${auth.username}:${auth.password}`));
      } else if (auth.type === 'apiKey' && auth.apiKey) {
        (requestOptions.headers as Headers).set('Authorization', auth.apiKeyId ? 'ApiKey ' + btoa(`${auth.apiKeyId}:${auth.apiKey}`) : `Bearer ${auth.apiKey}`);
      }
    }

    console.log(`Fetching schema from URL: ${url}`);
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Could not retrieve error body.");
      console.error(`Failed to fetch schema from ${url}. Status: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      if (response.status === 404 || errorBody.includes("index_not_found_exception")) {
          throw new Error(`No indices found matching pattern '${indexPattern}' on cluster '${activeClusterConfig.name}'. (Status: ${response.status})`);
      }
      throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}. Details: ${errorBody}`);
    }

    const rawResponse = await response.json();
    let actualMappings: Record<string, any> | undefined;
    let resolvedIndexName = indexPattern;
    let settings: Record<string, any> | undefined;

    if (rawResponse && typeof rawResponse === 'object' && Object.keys(rawResponse).length > 0) {
        const indexKeys = Object.keys(rawResponse);
        resolvedIndexName = indexKeys[0]; 
        actualMappings = rawResponse[resolvedIndexName]?.mappings;
        settings = rawResponse[resolvedIndexName]?.settings;
    }

    if (!actualMappings || typeof actualMappings.properties !== 'object') {
        console.warn(`No valid 'properties' field found in mappings for index '${resolvedIndexName}'. Raw Mappings:`, actualMappings);
        actualMappings = { properties: {} }; // Ensure analysis can run on empty properties
    }
    
    const analysis = this.analyzeSchema(actualMappings);

    return {
      indexName: resolvedIndexName,
      mappings: actualMappings,
      settings,
      analysis,
      rawResponse,
      timestamp: Date.now(),
      source: 'discovery'
    };
  }

  private _analyzeFieldsRecursive(
    properties: Record<string, any>,
    currentPath: string,
    analysisResultsContainer: { // Pass as an object to modify by reference
      searchableFields: SchemaField[];
      aggregatableFields: SchemaField[];
      dateFields: SchemaField[];
      geoFields: SchemaField[];
      nestedFields: SchemaField[];
      objectFields: SchemaField[];
    }
  ): SchemaField[] {
    const analyzedProperties: SchemaField[] = [];

    for (const key in properties) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;

      const esField = properties[key];
      const fieldName = currentPath ? `${currentPath}.${key}` : key;
      const fieldType = esField.type;

      const schemaField: SchemaField = { name: fieldName, type: fieldType || 'object' }; // Default to object if type is missing

      if (fieldType) {
        // Searchable: text, keyword, boolean, ip, specific numeric types if sensible
        if (['text', 'keyword', 'boolean', 'ip', 'date', 'long', 'integer', 'short', 'byte', 'double', 'float'].includes(fieldType)) {
          schemaField.searchable = true;
        }
        // Aggregatable: keyword, numerics, date, boolean, ip
        if (['keyword', 'long', 'integer', 'short', 'byte', 'double', 'float', 'date', 'boolean', 'ip', 'date_nanos'].includes(fieldType)) {
          schemaField.aggregatable = true;
        }
        // Text fields are searchable, but for aggregations, their .keyword subfield is preferred.
        if (fieldType === 'text') {
            schemaField.searchable = true; 
            // Only mark as aggregatable if no common keyword subfield exists (less ideal scenario)
            schemaField.aggregatable = !(esField.fields && esField.fields.keyword); 
        }


        if (fieldType === 'date' || fieldType === 'date_nanos') analysisResultsContainer.dateFields.push(schemaField);
        if (fieldType === 'geo_point' || fieldType === 'geo_shape') analysisResultsContainer.geoFields.push(schemaField);
        if (fieldType === 'nested') {
            analysisResultsContainer.nestedFields.push(schemaField);
            schemaField.searchable = true; 
            schemaField.aggregatable = true;
        }
         if (fieldType === 'object' && esField.properties) {
            analysisResultsContainer.objectFields.push(schemaField);
            // Object fields themselves aren't directly searchable/aggregatable in the same way leaf fields are.
            // Their sub-fields are.
            schemaField.searchable = false;
            schemaField.aggregatable = false;
        }
        
        // Add to main lists based on flags
        if (schemaField.searchable && !analysisResultsContainer.searchableFields.some(f => f.name === schemaField.name)) {
             analysisResultsContainer.searchableFields.push(schemaField);
        }
        if (schemaField.aggregatable && !analysisResultsContainer.aggregatableFields.some(f => f.name === schemaField.name)) {
             analysisResultsContainer.aggregatableFields.push(schemaField);
        }
      }

      if (esField.properties && typeof esField.properties === 'object') {
        schemaField.properties = this._analyzeFieldsRecursive(esField.properties, fieldName, analysisResultsContainer);
      } else if (esField.fields && typeof esField.fields === 'object') { // Handle multi-fields like .keyword
         // Effectively, these are sub-fields of the current fieldName.
         // We treat them as separate fields in the flat list for query building.
         this._analyzeFieldsRecursive(esField.fields, fieldName, analysisResultsContainer);
      }
      analyzedProperties.push(schemaField);
    }
    return analyzedProperties;
  }

  public analyzeSchema(mappings: any): SchemaAnalysis {
    const analysisResultsContainer = {
      searchableFields: [],
      aggregatableFields: [],
      dateFields: [],
      geoFields: [],
      nestedFields: [],
      objectFields: [],
    };
    const suggestions: string[] = [];

    if (mappings && mappings.properties && typeof mappings.properties === 'object') {
      this._analyzeFieldsRecursive(mappings.properties, '', analysisResultsContainer);
    } else {
        suggestions.push("Mappings object is empty or does not contain a 'properties' field. Schema analysis might be incomplete.");
    }
    
    // Deduplication is handled by the conditional push within _analyzeFieldsRecursive now.
    this.generateSchemaSuggestions({ ...analysisResultsContainer, suggestions }); // Pass a copy with current suggestions
    return { ...analysisResultsContainer, suggestions };
  }

  public generateSchemaSuggestions(analysis: SchemaAnalysis): void {
    // This method modifies analysis.suggestions directly based on the passed analysis object
    analysis.searchableFields.forEach(field => {
      if (field.type === 'text' && !field.name.endsWith('.keyword')) {
        const keywordVariantExists = analysis.searchableFields.some(sf => sf.name === `${field.name}.keyword` && sf.type === 'keyword');
        if (keywordVariantExists) {
          if(!analysis.suggestions.includes(`For exact, case-sensitive searches on '${field.name}', consider using '${field.name}.keyword'.`))
            analysis.suggestions.push(`For exact, case-sensitive searches on '${field.name}', consider using '${field.name}.keyword'.`);
        } else {
          if(!analysis.suggestions.includes(`Field '${field.name}' is a 'text' field (analyzed). For exact matches, ensure a '.keyword' subfield is available and used.`))
            analysis.suggestions.push(`Field '${field.name}' is a 'text' field (analyzed). For exact matches, ensure a '.keyword' subfield is available and used.`);
        }
      }
    });
    analysis.aggregatableFields.forEach(field => { // Note: this list might already prefer .keyword fields
        if (field.type === 'text' && !field.name.endsWith('.keyword')) {
            if(!analysis.suggestions.includes(`Field '${field.name}' is 'text' and marked aggregatable. This is unusual. Aggregations on analyzed text fields operate on tokens. Prefer '.keyword' subfields for aggregations on text.`))
             analysis.suggestions.push(`Field '${field.name}' is 'text' and marked aggregatable. This is unusual. Aggregations on analyzed text fields operate on tokens. Prefer '.keyword' subfields for aggregations on text.`);
        }
    });
    if (analysis.dateFields.length > 0) {
      analysis.suggestions.push(`Date fields found (e.g., '${analysis.dateFields[0].name}'). These can be used for date range queries and date histograms.`);
    }
    if (analysis.geoFields.length > 0) {
      analysis.suggestions.push(`Geo fields found (e.g., '${analysis.geoFields[0].name}'). Suitable for geo-spatial queries.`);
    }
    if (analysis.nestedFields.length > 0) {
        analysis.suggestions.push(`Nested fields found (e.g., '${analysis.nestedFields[0].name}'). Use nested queries/aggregations to interact with them.`);
    }
  }

  // --- Mock Schema Methods ---
  getMockLogsSchema(indexName: string = "mock-logs-*"): ESSchema {
    const mappings = {
      properties: {
        "@timestamp": { type: "date" },
        "message": { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } },
        "host": { properties: { "name": { type: "keyword" }, "ip": { type: "ip" } } },
        "level": { type: "keyword" },
        "service": { properties: { "name": { type: "keyword" }, "version": { type: "keyword"} } },
        "trace": { properties: { "id": { type: "keyword" } } },
        "tags": { type: "keyword" },
        "geoip": { properties: { "location": { type: "geo_point" } } }
      }
    };
    const analysis = this.analyzeSchema(mappings);
    return { indexName, mappings, analysis, timestamp: Date.now(), source: 'mock' };
  }

  getMockMetricsSchema(indexName: string = "mock-metrics-*"): ESSchema {
     const mappings = {
      properties: {
        "@timestamp": { type: "date" },
        "metricset": { properties: { "name": { type: "keyword"} } },
        "value": { type: "double" },
        "labels": { type: "object", dynamic: true, properties: {} }, // Mocking dynamic labels
        "host": { properties: { "name": { type: "keyword" } } }
      }
    };
    const analysis = this.analyzeSchema(mappings);
    return { indexName, mappings, analysis, timestamp: Date.now(), source: 'mock' };
  }
  
  getMockUsersSchema(indexName: string = "mock-users"): ESSchema {
    const mappings = {
        properties: {
            "user_id": { "type": "keyword" },
            "username": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
            "email": { "type": "keyword" },
            "full_name": { "type": "text" },
            "created_at": { "type": "date" },
            "last_login": { "type": "date" },
            "address": { 
                "type": "nested", // Correctly marking as nested for specific handling
                "properties": {
                    "street": { "type": "text" },
                    "city": { "type": "keyword" },
                    "zip_code": { "type": "keyword" },
                    "location": { "type": "geo_point" }
                }
            },
            "roles": { "type": "keyword" } // Typically an array of keywords
        }
    };
    const analysis = this.analyzeSchema(mappings);
    return { indexName, mappings, analysis, timestamp: Date.now(), source: 'mock' };
  }

  getMockDefaultSchema(indexName: string = "mock-default-*"): ESSchema {
    const mappings = {
      properties: {
        "@timestamp": { type: "date" },
        "message": { type: "text" },
        "keyword_field": { type: "keyword" },
        "numeric_field": { type: "long" },
        "object_field": { properties: { "nested_keyword": { type: "keyword" } } }
      }
    };
    const analysis = this.analyzeSchema(mappings);
    return { indexName, mappings, analysis, timestamp: Date.now(), source: 'mock' };
  }
}
