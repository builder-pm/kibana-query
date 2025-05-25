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
// This avoids circular dependencies if service types are needed by agent tools in the future,
// or provides a central point for service-layer specific types.
// For now, only connection-related types are defined here.
// If other tool types are needed by services, they should be imported directly or re-exported carefully.
// Note: The following export was from a previous subtask, retaining it for completeness if it was intended.
// If these specific types are not used by services, this re-export can be removed.
export type { 
    IntentParserInput, 
    ParsedIntent, 
    ExampleQuery,
    SchemaAnalyzerInput,
    AnalyzedField,
    SchemaAnalysisOutput,
    QueryBuilderInput,
    QueryBuilderOutput,
    ValidationToolInput,
    ValidationResultItem,
    ValidationToolOutput,
    ExplanationToolInput,
    ExplanationToolOutput
} from '../../agent/tools/elasticsearch/types';
