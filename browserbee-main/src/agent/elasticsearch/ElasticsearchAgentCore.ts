import { ESConfigManager } from '../../services/elasticsearch/ESConfigManager';
import { QueryLibraryManager, ExampleQuery } from '../../services/elasticsearch/QueryLibraryManager'; // Added ExampleQuery import
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
  // ExampleQuery // Already imported from QueryLibraryManager
} from './tools'; // Assuming tools are exported from an index.ts in ./tools

// Define an interface for configuration if needed in the future
export interface ElasticsearchAgentCoreConfig {
  // Add configuration properties here, e.g., API keys, model preferences for query generation
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
  private esConnectionManager: ESConnectionManager;
  private schemaManager: ESSchemaManager;

  // Tool instances
  private intentParserTool: ESIntentParserTool;
  private schemaAnalyzerTool: SchemaAnalyzerTool;
  private queryBuilderTool: ESQueryBuilderTool;
  private validationTool: ESValidationTool;
  private explanationTool: ExplanationTool;

  constructor(config?: ElasticsearchAgentCoreConfig) {
    this.esConfigManager = new ESConfigManager();
    this.queryLibraryManager = new QueryLibraryManager(this.esConfigManager);
    this.queryLibraryManager.loadAndInitializeLibrary().catch(error => {
      console.error("Failed to initialize QueryLibraryManager in ElasticsearchAgentCore:", error);
    });

    this.esConnectionManager = new ESConnectionManager(this.esConfigManager);
    this.schemaManager = new ESSchemaManager(this.esConnectionManager);

    // Initialize tools
    this.intentParserTool = new ESIntentParserTool();
    this.schemaAnalyzerTool = new SchemaAnalyzerTool();
    this.queryBuilderTool = new ESQueryBuilderTool();
    this.validationTool = new ESValidationTool();
    this.explanationTool = new ExplanationTool();

    if (config) {
      console.log("ElasticsearchAgentCore initialized with config:", config);
    } else {
      console.log("ElasticsearchAgentCore initialized with all tools.");
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

    try {
      // 1. Fetch schema
      try {
        rawSchema = await this.schemaManager.getSchema(clusterId, indexPattern);
        if (!rawSchema || (typeof rawSchema === 'object' && Object.keys(rawSchema).length === 0)) {
            throw new Error('Fetched schema is empty or invalid.');
        }
        // Assuming rawSchema has a 'mappings' property or is the mappings object itself.
        // Adjust if schemaManager.getSchema returns just the mappings.
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
        // Decide if we can proceed without schema or must return
        // For now, let's allow proceeding, intent parser can work without schemaSummary
        // but query builder might be less effective.
        schemaAnalysis = { analyzedFields: [], fieldIndex: {}, errors: [e.message] }; // Provide a default empty analysis
      }

      // 2. (Optional) Get example queries
      // For simplicity, getting all. A more targeted approach might be better.
      const exampleQueries = (await this.queryLibraryManager.getExamples(undefined) as Record<string, ExampleQuery[]>);
      let flatExampleQueries: ExampleQuery[] = [];
      if (exampleQueries) {
        flatExampleQueries = Object.values(exampleQueries).flat();
      }


      // 3. Parse intent
      try {
        const intentParserInput: IntentParserInput = {
          naturalLanguageInput: userInput,
          schemaSummary: schemaAnalysis?.schemaSummary,
          exampleQueries: flatExampleQueries.slice(0, 5) // Limit examples for prompt size
        };
        parsedIntent = await this.intentParserTool.execute(intentParserInput);
        if (parsedIntent.errors && parsedIntent.errors.length > 0) {
            errors.push({ step: 'parseIntent', message: 'Intent parsing returned errors.', details: parsedIntent.errors });
        }
      } catch (e: any) {
        errors.push({ step: 'parseIntent', message: e.message || 'Failed to parse user intent.' });
        // If intent parsing fails, we cannot proceed to build a query.
        return this.compileResult(userInput, null, undefined, undefined, undefined, undefined, parsedIntent, schemaAnalysis?.schemaSummary, errors);
      }
      
      // 4. Build query
      try {
        queryBuilderOutput = await this.queryBuilderTool.execute({ 
            parsedIntent, 
            schemaAnalysis: schemaAnalysis!, // schemaAnalysis is initialized even on error
            exampleQueries: flatExampleQueries.slice(0,2) // Fewer examples for builder
        });
        if (!queryBuilderOutput.query || (queryBuilderOutput.errors && queryBuilderOutput.errors.length > 0)) {
          errors.push({ step: 'buildQuery', message: 'Query building failed or returned errors.', details: queryBuilderOutput.errors });
          // If query building fails, we cannot validate or explain.
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
}
