// Define interfaces for query structure from QueryLibraryManager for context
export interface ExampleQuery {
  id: string;
  description: string;
  naturalLanguageQuery: string; // Mapped from userIntent or description
  query: object; // The actual Elasticsearch query object
  tags?: string[];
  complexity?: string;
  successRate?: number;
}

export interface IntentParserInput {
  naturalLanguageInput: string;
  schemaSummary?: string; // Optional, a summarized version of the ES schema/mappings
  exampleQueries?: ExampleQuery[]; // Optional, from QueryLibraryManager
}

export interface ParsedIntent {
  originalInput: string;
  queryType: 'search' | 'aggregation' | 'mixed' | 'unknown';
  entities: Array<{
    name: string; // e.g., "status", "product_name", "search_term"
    type: string; // e.g., "filter", "keyword", "geo_location", "numeric_range"
    value: any;   // e.g., "active", "laptop", { "lat": 40.7128, "lon": -74.0060 }, { "gte": 100, "lte": 200 }
    field?: string; // Optional: specific ES field, e.g., "status.keyword", "product_name.text", "price"
  }>;
  dateRanges?: Array<{
    field: string;
    range: {
      gte?: string; // "now-7d/d", "2023-01-01"
      lte?: string; // "now", "2023-12-31"
      format?: string; // "yyyy-MM-dd"
    };
  }>;
  sort?: Array<{
    field: string;
    order: 'asc' | 'desc';
  }>;
  aggregationRequests?: Array<{
    type: string; // e.g., "terms", "date_histogram", "stats", "avg", "cardinality"
    field?: string; // Field to aggregate on (not always needed for e.g. filter aggregations)
    name: string; // Name for the aggregation result, how it will be keyed in the response
    settings?: any; // Additional settings, e.g., { "interval": "day" } for date_histogram, { "size": 10 } for terms
  }>;
  confidenceScore?: number; // 0-1, how confident the parser is in its interpretation
  errors?: string[]; // If parsing failed to extract key info or other issues encountered
}

// ---- Interfaces for SchemaAnalyzerTool ----

export interface SchemaAnalyzerInput {
  rawMappings: Record<string, any>; // e.g., indexName.mappings
  indexSettings?: Record<string, any>; // Optional, index settings
}

export interface AnalyzedField {
  fieldName: string; // Full path, e.g., "user.name.keyword"
  type: string; // e.g., "keyword", "text", "date", "long", "nested", "object"
  properties?: AnalyzedField[]; // For nested or object types
  isArray?: boolean; // Attempt to infer if it's an array (can be heuristic)
  analyzers?: string[]; // If 'analyzer' or 'search_analyzer' is specified for text fields
}

export interface SchemaAnalysisOutput {
  analyzedFields: AnalyzedField[]; // A list of all analyzed fields (can be flat or retain nesting for top-level)
  fieldIndex: Record<string, AnalyzedField>; // Quick lookup map: fieldName -> AnalyzedField
  schemaSummary?: string; // Concise textual summary of key fields and types
  errors?: string[];
}

// ---- Interfaces for ESQueryBuilderTool ----

export interface QueryBuilderInput {
  parsedIntent: ParsedIntent;
  schemaAnalysis: SchemaAnalysisOutput;
  exampleQueries?: ExampleQuery[]; // Optional, relevant examples for few-shot prompting
}

export interface QueryBuilderOutput {
  query: Record<string, any> | null; // The generated Elasticsearch DSL query object
  queryId?: string; // A unique identifier for the generated query
  confidenceScore?: number; // How confident the builder is in the generated query
  warnings?: string[]; // Potential issues or suggestions
  errors?: string[]; // Errors that prevented query generation
}

// ---- Interfaces for ESValidationTool ----

export interface ValidationToolInput {
  query: Record<string, any>; // The Elasticsearch DSL query object to validate
  schemaAnalysis: SchemaAnalysisOutput; // Output from SchemaAnalyzerTool
}

export interface ValidationResultItem {
  type: 'error' | 'warning' | 'suggestion';
  message: string;
  fieldPath?: string; // Optional, path to the field in the query causing the issue
}

export interface ValidationToolOutput {
  isValid: boolean; // True if no errors are found, warnings might still exist
  results: ValidationResultItem[]; // A list of all errors, warnings, and suggestions
  validatedQuery?: Record<string, any>; // Optional, if the tool made minor auto-corrections
}

// ---- Interfaces for ExplanationTool ----

export interface ExplanationToolInput {
  query: Record<string, any>; // The Elasticsearch DSL query object
  parsedIntent?: ParsedIntent; // Optional, the intent that generated the query
  schemaAnalysis?: SchemaAnalysisOutput; // Optional, the schema analysis for context
}

export interface ExplanationToolOutput {
  explanation: string; // The natural language explanation of the query
  confidenceScore?: number; // Optional, how confident the tool is in its explanation
  errors?: string[];
}
