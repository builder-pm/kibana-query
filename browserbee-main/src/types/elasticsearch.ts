// Elasticsearch-specific type definitions
export interface ESConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  indexName: string;
  auth: {
    type: 'none' | 'basic' | 'api_key';
    username?: string;
    password?: string;
    apiKey?: string;
  };
  timeout: number;
}

export interface ESSchema {
  mappings: {
    properties: Record<string, FieldMapping>;
  };
  indexName: string;
  version: string;
  lastUpdated: Date;
}

export interface FieldMapping {
  type: 'text' | 'keyword' | 'long' | 'integer' | 'date' | 'boolean' | 'geo_point' | 'nested';
  fields?: Record<string, FieldMapping>;
  properties?: Record<string, FieldMapping>;
}

export interface ParsedIntent {
  entities: {
    companies: string[];
    locations: string[];
    skills: string[];
    jobTitles: string[];
    dateRanges: DateRange[];
    salaryRanges: SalaryRange[];
  };
  analysisType: 'search' | 'aggregation' | 'analytics';
  complexity: 'simple' | 'medium' | 'complex';
  confidence: number;
  rawInput: string;
}

export interface DateRange {
  gte?: string;
  lte?: string;
  gt?: string;
  lt?: string;
}

export interface SalaryRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface QueryPerspective {
  id: string;
  name: string;
  description: string;
  approach: 'exact_match' | 'fuzzy_search' | 'analytics' | 'trend_analysis';
  reasoning: string;
  confidence: number;
}

export interface ESQuery {
  query: any;
  size?: number;
  from?: number;
  _source?: string[] | boolean;
  aggs?: any;
  sort?: any[];
  timeout?: string;
}

export interface QueryResult {
  query: ESQuery;
  perspective: QueryPerspective;
  validation: ValidationResult;
  reasoning: string;
  complexity: number;
  estimatedPerformance: PerformanceMetrics;
}

export interface ValidationResult {
  isValid: boolean;
  syntaxErrors: string[];
  schemaErrors: string[];
  performanceWarnings: string[];
  securityIssues: string[];
  score: number;
}

export interface PerformanceMetrics {
  executionTime?: number;
  complexityScore: number;
  optimizationSuggestions: string[];
}

export interface SampleQuery {
  id: string;
  description: string;
  userIntent: string;
  query: ESQuery;
  tags: string[];
  complexity: 'simple' | 'medium' | 'complex';
  successRate: number;
}
