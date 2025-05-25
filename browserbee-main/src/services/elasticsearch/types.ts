// ---- Interfaces for ESConnectionManager ----

export interface ESAuthDetails {
  type: 'none' | 'basic' | 'apiKey';
  username?: string;
  password?: string;
  apiKey?: string; // Can be Base64 encoded "id:api_key" or a Bearer token
  apiKeyId?: string; // Optional, used if apiKey is just the key part for ES "API Key" auth
}

export interface ESClusterConfig {
  id: string; // Unique identifier for the cluster
  name: string; // User-defined name
  host: string;
  port: number;
  protocol: 'http' | 'https';
  auth: ESAuthDetails;
  createdAt?: string; // ISO date string
}

export interface ClusterHealth {
  status: 'connected' | 'disconnected' | 'error';
  message?: string; // e.g., error message, ES version
  esVersion?: string;
}

// Re-exporting types from agent/tools/elasticsearch/types.ts for service layer usage if needed
export type { 
    IntentParserInput, 
    ParsedIntent, 
    ExampleQuery,
    SchemaAnalyzerInput,
    AnalyzedField, // This is used by agent tools, SchemaField below is for ESSchemaManager's direct use
    SchemaAnalysisOutput, // This is from agent tools, SchemaAnalysis below is for ESSchemaManager's direct use
    QueryBuilderInput,
    QueryBuilderOutput,
    ValidationToolInput,
    ValidationResultItem,
    ValidationToolOutput,
    ExplanationToolInput,
    ExplanationToolOutput
} from '../../agent/tools/elasticsearch/types';

// ---- Interfaces for ESSchemaManager ----

// Represents a field in the analyzed schema.
export interface SchemaField {
  name: string; // Full path, e.g., user.name.keyword
  type: string; // e.g., keyword, text, date, long, nested, object
  searchable?: boolean; // Determined by analysis
  aggregatable?: boolean; // Determined by analysis
  // esType?: string; // The raw Elasticsearch type
  properties?: SchemaField[]; // For nested or object types
}

export interface SchemaAnalysis {
  searchableFields: SchemaField[];
  aggregatableFields: SchemaField[];
  dateFields: SchemaField[];
  geoFields: SchemaField[];
  nestedFields: SchemaField[]; // Fields of type 'nested'
  objectFields?: SchemaField[]; // Fields of type 'object' (non-nested, regular objects)
  suggestions: string[]; // e.g., "Consider using 'user.name.keyword' for exact searches on user names."
  // Potentially add a summary string here too, if different from agent tool's summary
}

export interface ESSchema {
  indexName: string; // The resolved index name or pattern used for fetching
  mappings: Record<string, any>; // Raw mappings for the index (or the primary one if multiple)
  settings?: Record<string, any>; // Optional: Raw settings for the index
  analysis: SchemaAnalysis;
  rawResponse?: any; // Optional: raw response from _mapping if needed for other purposes
  timestamp?: number; // When this schema object was created/fetched/retrieved from cache
  source?: 'cache' | 'discovery' | 'mock'; // Origin of the schema
}
