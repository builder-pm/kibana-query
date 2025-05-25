import { ESConfigManager } from '../../services/elasticsearch/ESConfigManager';
import { QueryLibraryManager, ExampleQuery } from '../../services/elasticsearch/QueryLibraryManager';
import { ESConnectionManager } from '../../services/elasticsearch/ESConnectionManager';
import { ESSchemaManager } from '../../services/elasticsearch/ESSchemaManager';
import {
  ESIntentParserTool,
  SchemaAnalyzerTool,
  ESQueryBuilderTool,
  ESValidationTool,
  ExplanationTool,
  IntentParserInput,
  ParsedIntent,
  SchemaAnalysisOutput,
  QueryBuilderOutput,
  ValidationToolOutput,
  ExplanationToolOutput,
} from './tools';

// Imports for LLMProvider initialization
import { ConfigManager, ProviderConfig } from '../../background/configManager';
import { createProvider } from '../../models/providers/factory';
import { LLMProvider } from '../../models/providers/types';

// Define an interface for configuration if needed in the future
export interface ElasticsearchAgentCoreConfig {
  // Add configuration properties here
}

// Define a more comprehensive output structure for generateQuery
export interface GenerateQueryResult {
  userInput: string;
  query: Record<string, any> | null;
  queryId?: string;
  explanation?: string;
  validationResults?: any[]; // From ValidationResultItem[]
  isValid?: boolean;
  confidence?: {
    intent?: number;
    builder?: number;
    explanation?: number;
  };
  parsedIntent?: ParsedIntent;
  schemaSummary?: string;
  errors?: Array<{ step: string; message: string; details?: any }>;
}


export class ElasticsearchAgentCore {
  private esConfigManager: ESConfigManager;
  public queryLibraryManager: QueryLibraryManager;
  public esConnectionManager: ESConnectionManager; // Made public for ESMessageHandler
  private schemaManager: ESSchemaManager;

  // LLM Provider
  private llmProvider: LLMProvider | null = null;

  // Tool instances
  // Definite assignment assertion used as they are initialized in initialize()
  private intentParserTool!: ESIntentParserTool;
  private schemaAnalyzerTool: SchemaAnalyzerTool; // No LLM needed
  private queryBuilderTool!: ESQueryBuilderTool;
  private validationTool: ESValidationTool; // No LLM needed
  private explanationTool!: ExplanationTool;


  constructor(config?: ElasticsearchAgentCoreConfig) {
    this.esConfigManager = new ESConfigManager();
    this.queryLibraryManager = new QueryLibraryManager(this.esConfigManager);
    this.queryLibraryManager.loadAndInitializeLibrary().catch(error => {
      console.error("Failed to initialize QueryLibraryManager in ElasticsearchAgentCore:", error);
    });

    this.esConnectionManager = new ESConnectionManager(this.esConfigManager);
    this.schemaManager = new ESSchemaManager(this.esConnectionManager);

    // Initialize tools that don't require LLMProvider here
    this.schemaAnalyzerTool = new SchemaAnalyzerTool();
    this.validationTool = new ESValidationTool();
    
    // LLM-dependent tools are initialized in `initialize()`

    if (config) {
      console.log("ElasticsearchAgentCore constructor completed with config:", config);
    } else {
      console.log("ElasticsearchAgentCore constructor completed.");
    }
  }

  public async initialize(): Promise<void> {
    if (this.llmProvider) {
        console.log("LLMProvider already initialized.");
        return;
    }

    try {
      const configManager = ConfigManager.getInstance();
      // Assuming getProviderConfig correctly fetches and decrypts if necessary
      const providerConfig = await configManager.getProviderConfig(); 

      if (!providerConfig || !providerConfig.apiKey) {
        console.error("LLM provider not configured with API key in ElasticsearchAgentCore. LLM-dependent tools will not be available.");
        // Set a state or throw an error if critical
        // For now, tools requiring llmProvider will not be instantiated.
        return;
      }
      
      this.llmProvider = await createProvider(providerConfig.provider, providerConfig);
      console.log("LLMProvider initialized in ElasticsearchAgentCore:", providerConfig.provider);

      // Now that llmProvider is initialized, instantiate tools that depend on it
      this.intentParserTool = new ESIntentParserTool(this.llmProvider);
      this.queryBuilderTool = new ESQueryBuilderTool(this.llmProvider);
      this.explanationTool = new ExplanationTool(this.llmProvider);
      
      console.log("LLM-dependent Elasticsearch tools initialized.");

    } catch (error) {
      console.error("Error initializing LLMProvider in ElasticsearchAgentCore:", error);
      // Handle error, perhaps by setting a state that LLM features are unavailable
      // this.llmProvider remains null, and dependent tools remain uninitialized.
    }
  }


  public async generateQuery(userInput: string, clusterId: string, indexPattern?: string): Promise<GenerateQueryResult> {
    const errors: Array<{ step: string; message: string; details?: any }> = [];
    let rawSchema: any;
    let schemaAnalysis: SchemaAnalysisOutput | undefined;
    let parsedIntent: ParsedIntent | undefined;
    let queryBuilderOutput: QueryBuilderOutput | undefined;
    let validationResult: ValidationToolOutput | undefined;
    let explanationOutput: ExplanationToolOutput | undefined;

    // Ensure LLM provider is ready before proceeding with LLM-dependent steps
    if (!this.llmProvider || !this.intentParserTool || !this.queryBuilderTool || !this.explanationTool) {
      errors.push({ step: 'initialization', message: 'LLMProvider or dependent tools are not initialized. Cannot generate query.' });
      return this.compileResult(userInput, null, undefined, undefined, undefined, undefined, undefined, undefined, errors);
    }

    try {
      // 1. Fetch schema
      try {
        rawSchema = await this.schemaManager.getSchema(clusterId, indexPattern);
        if (!rawSchema || (typeof rawSchema === 'object' && Object.keys(rawSchema).length === 0)) {
            throw new Error('Fetched schema is empty or invalid.');
        }
        const mappingsToAnalyze = rawSchema.mappings || rawSchema;
         if (!mappingsToAnalyze || typeof mappingsToAnalyze !== 'object' || Object.keys(mappingsToAnalyze).length === 0) {
          throw new Error('Mappings object is missing or empty in the fetched schema.');
        }
        schemaAnalysis = await this.schemaAnalyzerTool.execute({ rawMappings: mappingsToAnalyze });
        if (schemaAnalysis.errors && schemaAnalysis.errors.length > 0) {
            errors.push({ step: 'schemaAnalysis', message: 'Schema analysis returned errors.', details: schemaAnalysis.errors });
        }
      } catch (e: any) {
        errors.push({ step: 'fetchSchema', message: e.message || 'Failed to fetch or analyze schema.' });
        schemaAnalysis = { analyzedFields: [], fieldIndex: {}, errors: [e.message] }; 
      }

      // 2. Get example queries
      const exampleQueriesData = (await this.queryLibraryManager.getExamples(undefined) as Record<string, ExampleQuery[]>);
      let flatExampleQueries: ExampleQuery[] = exampleQueriesData ? Object.values(exampleQueriesData).flat() : [];

      // 3. Parse intent
      try {
        const intentParserInput: IntentParserInput = {
          naturalLanguageInput: userInput,
          schemaSummary: schemaAnalysis?.schemaSummary,
          exampleQueries: flatExampleQueries.slice(0, 5) 
        };
        parsedIntent = await this.intentParserTool.execute(intentParserInput);
        if (parsedIntent.errors && parsedIntent.errors.length > 0) {
            errors.push({ step: 'parseIntent', message: 'Intent parsing returned errors.', details: parsedIntent.errors });
        }
      } catch (e: any) {
        errors.push({ step: 'parseIntent', message: e.message || 'Failed to parse user intent.' });
        return this.compileResult(userInput, null, undefined, undefined, undefined, undefined, parsedIntent, schemaAnalysis?.schemaSummary, errors);
      }
      
      // 4. Build query
      try {
        queryBuilderOutput = await this.queryBuilderTool.execute({ 
            parsedIntent, 
            schemaAnalysis: schemaAnalysis!, 
            exampleQueries: flatExampleQueries.slice(0,2)
        });
        if (!queryBuilderOutput.query || (queryBuilderOutput.errors && queryBuilderOutput.errors.length > 0)) {
          errors.push({ step: 'buildQuery', message: 'Query building failed or returned errors.', details: queryBuilderOutput.errors });
          return this.compileResult(userInput, queryBuilderOutput?.query, queryBuilderOutput?.queryId, undefined, undefined, undefined, parsedIntent, schemaAnalysis?.schemaSummary, errors, queryBuilderOutput?.confidenceScore);
        }
      } catch (e: any) {
        errors.push({ step: 'buildQuery', message: e.message || 'Failed to build query.' });
        return this.compileResult(userInput, null, undefined, undefined, undefined, undefined, parsedIntent, schemaAnalysis?.schemaSummary, errors);
      }

      // 5. Validate query
      try {
        validationResult = await this.validationTool.execute({ query: queryBuilderOutput.query!, schemaAnalysis: schemaAnalysis! });
        if (!validationResult.isValid || (validationResult.results && validationResult.results.some(r => r.type === 'error'))) {
             errors.push({ step: 'validateQuery', message: 'Query validation failed.', details: validationResult.results });
        }
      } catch (e: any) {
        errors.push({ step: 'validateQuery', message: e.message || 'Failed to validate query.' });
      }
      
      // 6. Explain query
      try {
        explanationOutput = await this.explanationTool.execute({ query: queryBuilderOutput.query!, parsedIntent, schemaAnalysis: schemaAnalysis! });
         if (explanationOutput.errors && explanationOutput.errors.length > 0) {
            errors.push({ step: 'explainQuery', message: 'Query explanation returned errors.', details: explanationOutput.errors });
        }
      } catch (e: any) {
        errors.push({ step: 'explainQuery', message: e.message || 'Failed to explain query.' });
      }

      return this.compileResult(
        userInput,
        queryBuilderOutput.query,
        queryBuilderOutput.queryId,
        explanationOutput?.explanation,
        validationResult?.results,
        validationResult?.isValid,
        parsedIntent,
        schemaAnalysis?.schemaSummary,
        errors,
        queryBuilderOutput.confidenceScore,
        explanationOutput?.confidenceScore
      );

    } catch (e: any) { // Catch-all for unexpected errors during orchestration
      errors.push({ step: 'orchestration', message: e.message || 'An unexpected error occurred during query generation.' });
      return this.compileResult(userInput, null, undefined, undefined, undefined, undefined, parsedIntent, schemaAnalysis?.schemaSummary, errors);
    }
  }
  
  private compileResult(
    userInput: string,
    query: Record<string, any> | null,
    queryId?: string,
    explanation?: string,
    validationResults?: any[],
    isValid?: boolean,
    parsedIntent?: ParsedIntent,
    schemaSummary?: string,
    errors?: Array<{ step: string; message: string; details?: any }>,
    builderConfidence?: number,
    explanationConfidence?: number
  ): GenerateQueryResult {
    return {
      userInput,
      query,
      queryId,
      explanation,
      validationResults,
      isValid: errors && errors.length > 0 ? false : isValid, // if any orchestration error, mark invalid
      confidence: {
        intent: parsedIntent?.confidenceScore,
        builder: builderConfidence,
        explanation: explanationConfidence,
      },
      parsedIntent,
      schemaSummary,
      errors: errors && errors.length > 0 ? errors : undefined,
    };
  }


  public async validateESQuery(queryToValidate: Record<string, any>, clusterId: string, indexPattern?: string): Promise<ValidationToolOutput> {
    try {
      const rawSchema = await this.schemaManager.getSchema(clusterId, indexPattern);
      const mappingsToAnalyze = rawSchema.mappings || rawSchema;
      if (!mappingsToAnalyze || typeof mappingsToAnalyze !== 'object' || Object.keys(mappingsToAnalyze).length === 0) {
          return { isValid: false, results: [{type: 'error', message: 'Mappings object is missing or empty in the fetched schema.'}] };
      }
      const schemaAnalysis = await this.schemaAnalyzerTool.execute({ rawMappings: mappingsToAnalyze });
       if (schemaAnalysis.errors && schemaAnalysis.errors.length > 0) {
           return { isValid: false, results: [{type: 'error', message: `Schema analysis failed: ${schemaAnalysis.errors.join(', ')}`}] };
       }
      return await this.validationTool.execute({ query: queryToValidate, schemaAnalysis });
    } catch (e: any) {
      console.error(`Error during validateESQuery:`, e);
      return { isValid: false, results: [{ type: 'error', message: e.message || 'Failed to validate query due to an internal error.' }] };
    }
  }

  public async explainESQuery(queryToExplain: Record<string, any>, clusterId?: string, indexPattern?: string): Promise<ExplanationToolOutput> {
    let schemaAnalysisOutput: SchemaAnalysisOutput | undefined = undefined;
    try {
      if (clusterId && indexPattern) { // Also check if indexPattern is not empty string
        const rawSchema = await this.schemaManager.getSchema(clusterId, indexPattern);
        const mappingsToAnalyze = rawSchema.mappings || rawSchema;
        if (mappingsToAnalyze && typeof mappingsToAnalyze === 'object' && Object.keys(mappingsToAnalyze).length > 0) {
            schemaAnalysisOutput = await this.schemaAnalyzerTool.execute({ rawMappings: mappingsToAnalyze });
            if (schemaAnalysisOutput.errors && schemaAnalysisOutput.errors.length > 0) {
                console.warn(`Schema analysis for explanation encountered errors: ${schemaAnalysisOutput.errors.join(', ')}`);
                // Proceed with explanation but schema context might be incomplete.
            }
        } else {
            console.warn('Mappings object is missing or empty for explanation context.');
        }
      }
      return await this.explanationTool.execute({ query: queryToExplain, schemaAnalysis: schemaAnalysisOutput });
    } catch (e: any) {
      console.error(`Error during explainESQuery:`, e);
      return { explanation: '', errors: [e.message || 'Failed to explain query due to an internal error.'] };
    }
  }

  public async importQueryLibraryFromJson(jsonData: string): Promise<{ success: boolean; message?: string }> {
    try {
      const dataObject = JSON.parse(jsonData);
      await this.queryLibraryManager.importExamples(dataObject);
      console.log('Query library imported successfully via ElasticsearchAgentCore.');
      return { success: true };
    } catch (e: any) {
      console.error('Error importing query library in ElasticsearchAgentCore:', e);
      return { success: false, message: e.message || 'Failed to import query library.' };
    }
  }

  public async getESSchema(clusterId: string, indexPattern: string): Promise<any | { error: string }> { // Return type should be ESSchema from service types, but using 'any' to avoid import errors if not co-located or properly exported yet.
    try {
      // ESSchemaManager.getSchema returns ESSchema, which includes the analysis.
      // The SchemaAnalysisOutput from the agent tool is slightly different.
      // For now, we'll return the ESSchema from the service layer directly.
      // The UI might need to adapt or this method could transform it.
      const schema = await this.schemaManager.getSchema(clusterId, indexPattern);
      if (!schema || (schema.source === 'mock' && schema.indexName.includes('mock-default'))) { // Check if it's the absolute fallback mock
          // This indicates a significant problem if a specific index was requested.
          // If schema.error is already part of ESSchema, that would be better.
          // For now, we'll rely on the source and a basic check.
          if (schema.mappings && Object.keys(schema.mappings.properties || {}).length === 0) {
            return { error: `Failed to retrieve a valid schema for '${indexPattern}'. A default mock was returned due to previous errors.` };
          }
      }
      return schema;
    } catch (e: any) {
      console.error(`Error in getESSchema for cluster ${clusterId}, pattern ${indexPattern}:`, e);
      return { error: e.message || 'An unknown error occurred while fetching schema.' };
    }
  }
}
