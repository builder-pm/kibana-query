import { ParsedIntent, SchemaAnalysisOutput, ExampleQuery, QueryBuilderInput, QueryBuilderOutput, AnalyzedField } from './types'; // Added AnalyzedField
import { LLMProvider, ApiStream, StreamChunk } from '../../../models/providers/types'; // Adjusted path

export class ESQueryBuilderTool {
  private readonly llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    console.log("ESQueryBuilderTool initialized with LLMProvider.");
  }

  private constructSystemPrompt(): string {
    return `You are an expert Elasticsearch query writer. 
Your task is to generate an Elasticsearch DSL query based on a structured user intent and a schema analysis. 
Respond ONLY with the valid JSON for the Elasticsearch query. 
Do not include any explanations or surrounding text.
Do not wrap the JSON in \`\`\`json ... \`\`\` markers.
Ensure the generated query is a valid Elasticsearch query.`;
  }

  private constructUserPrompt(input: QueryBuilderInput): string {
    let userPrompt = "Generate an Elasticsearch DSL query based on the following structured intent and schema analysis.\n\n";

    userPrompt += "=== User Intent ===\n";
    userPrompt += `${JSON.stringify(input.parsedIntent, null, 2)}\n\n`;

    userPrompt += "=== Schema Analysis Summary ===\n";
    userPrompt += `${input.schemaAnalysis.schemaSummary || 'No schema summary available.'}\n\n`;

    if (input.schemaAnalysis.analyzedFields && input.schemaAnalysis.analyzedFields.length > 0) {
      userPrompt += "=== Key Schema Fields (subset for context) ===\n";
      // Attempt to show fields relevant to intent entities first, then general fields.
      let relevantFields: AnalyzedField[] = [];
      if (input.parsedIntent.entities) {
        const intentFieldNames = new Set(input.parsedIntent.entities.map(e => e.field).filter(f => !!f));
        relevantFields = input.schemaAnalysis.analyzedFields.filter(f => intentFieldNames.has(f.fieldName));
      }
      
      // If not enough relevant fields found, or no entities, add some top-level fields
      if (relevantFields.length < 5) {
        const generalFields = input.schemaAnalysis.analyzedFields
          .filter(f => !f.fieldName.includes('.') && !relevantFields.some(rf => rf.fieldName === f.fieldName)) // Non-nested and not already included
          .slice(0, 5 - relevantFields.length);
        relevantFields.push(...generalFields);
      }
      // Ensure unique fields if some were added from both lists
      relevantFields = Array.from(new Set(relevantFields.map(f => f.fieldName)))
          .map(fieldName => relevantFields.find(f => f.fieldName === fieldName)!);


      if (relevantFields.length > 0) {
        relevantFields.slice(0, 10).forEach(field => { // Limit total displayed fields
          userPrompt += `- ${field.fieldName} (type: ${field.type}${field.analyzers ? `, analyzers: ${field.analyzers.join(', ')}` : ''})\n`;
        });
      } else {
         // Fallback if no fields could be selected (e.g. schema is very flat and no entities matched)
        input.schemaAnalysis.analyzedFields.slice(0,5).forEach(field => { // Show first 5
             userPrompt += `- ${field.fieldName} (type: ${field.type}${field.analyzers ? `, analyzers: ${field.analyzers.join(', ')}` : ''})\n`;
        });
      }
      userPrompt += "\n";
    }
    

    if (input.exampleQueries && input.exampleQueries.length > 0) {
      userPrompt += "=== Example Queries for Similar Intents ===\n";
      // Limit to 1-2 examples for brevity
      input.exampleQueries.slice(0, 2).forEach(ex => {
        userPrompt += `Natural Language: "${ex.naturalLanguageQuery || ex.description}"\n`;
        userPrompt += `DSL Query:\n${JSON.stringify(ex.query, null, 2)}\n\n`;
      });
    }

    userPrompt += "Please generate ONLY the Elasticsearch DSL query as a valid JSON object based on the provided intent and schema. Do not include any other text or explanations.";
    return userPrompt;
  }

  private buildSimpleQuery(parsedIntent: ParsedIntent, schemaAnalysis: SchemaAnalysisOutput): Record<string, any> {
    const esQuery: Record<string, any> = { query: { bool: { must: [], filter: [], should: [], must_not: [] } } };
  // The buildSimpleQuery method is removed as per instructions. LLM will generate the query.

  async execute(input: QueryBuilderInput): Promise<QueryBuilderOutput> {
    const systemPrompt = this.constructSystemPrompt();
    const userPromptString = this.constructUserPrompt(input);

    console.log("ESQueryBuilderTool: System Prompt:", systemPrompt);
    console.log("ESQueryBuilderTool: User Prompt (first 300 chars):", userPromptString.substring(0, 300));
    
    const messages = [{ role: 'user' as const, content: userPromptString }];
    
    let accumulatedLLMResponse = "";
    let llmError: string | null = null;

    const output: QueryBuilderOutput = {
        query: null,
        queryId: `llm-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
        confidenceScore: 0.1, // Default low confidence
        warnings: [],
        errors: [],
    };

    try {
      const stream: ApiStream = this.llmProvider.createMessage(systemPrompt, messages); // No tools passed
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          accumulatedLLMResponse += chunk.text;
        }
      }
    } catch (error: any) {
      console.error("Error during LLM call in ESQueryBuilderTool:", error);
      llmError = error.message || "LLM call failed";
    }

    const llmResponseString = accumulatedLLMResponse;
    console.log("ESQueryBuilderTool: Actual LLM Response String:", llmResponseString);


    if (llmError || !llmResponseString.trim()) {
      output.errors?.push(llmError || "LLM response was empty.");
      output.confidenceScore = 0.05;
      console.error("ESQueryBuilderTool: Error from LLM or empty response.", output.errors);
      return output;
    }

    try {
      let cleanedResponseString = llmResponseString;

      // 1. Improved Pre-Parsing Cleaning
      cleanedResponseString = cleanedResponseString.replace(/^```json\s*|```\s*$/g, '').trim();
      
      const firstBrace = cleanedResponseString.indexOf('{');
      const lastBrace = cleanedResponseString.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const potentialJson = cleanedResponseString.substring(firstBrace, lastBrace + 1);
        try {
          JSON.parse(potentialJson); 
          cleanedResponseString = potentialJson; 
          console.log("ESQueryBuilderTool: Extracted potential JSON block from LLM response.");
        } catch (e) {
          console.warn("ESQueryBuilderTool: Could not cleanly extract a JSON block, proceeding with original cleaned string (after markdown removal).");
        }
      }
      
      const parsedJson = JSON.parse(cleanedResponseString);
      output.query = parsedJson;

      // Basic validation from previous step
      if (output.query && typeof output.query === 'object') {
        const hasQueryKey = Object.prototype.hasOwnProperty.call(output.query, 'query');
        const hasAggsKey = Object.prototype.hasOwnProperty.call(output.query, 'aggs');
        if (!hasQueryKey && !hasAggsKey) {
          const hasOtherKeys = ['sort', 'size', 'from', '_source', 'fields', 'script_fields', 'highlight', 'rescore', 'explain', 'version', 'seq_no_primary_term', 'stats', 'timeout', 'terminate_after', 'profile', 'pit', 'runtime_mappings', 'search_after', 'min_score', 'track_scores', 'track_total_hits', 'indices_boost'].some(key => Object.prototype.hasOwnProperty.call(output.query, key));
          if (!hasOtherKeys) {
            output.warnings?.push("Generated query does not have a top-level 'query' or 'aggs' key, nor other common top-level Elasticsearch keys. This might indicate an issue.");
            output.confidenceScore = (output.confidenceScore || 0.5) * 0.7;
          }
        }
        if(input.parsedIntent.queryType === 'search' && !hasQueryKey && hasAggsKey && !Object.prototype.hasOwnProperty.call(output.query, 'size')){
            output.warnings?.push("Intent was 'search' but only 'aggs' key found in query without 'size:0' or an explicit query clause. Results might be unexpected.");
            output.confidenceScore = (output.confidenceScore || 0.5) * 0.8;
        }
        if(input.parsedIntent.queryType === 'aggregation' && hasQueryKey && !hasAggsKey){
            output.warnings?.push("Intent was 'aggregation' but only 'query' key found, no 'aggs'. The query might not perform aggregations as expected.");
            output.confidenceScore = (output.confidenceScore || 0.5) * 0.8;
        }
        if (output.warnings?.length === 0) { // If no new warnings from these checks
            output.confidenceScore = (input.parsedIntent.confidenceScore || 0.6) * 0.9;
        } else {
            output.confidenceScore = (input.parsedIntent.confidenceScore || 0.6) * 0.7;
        }
      } else {
        throw new Error("LLM response did not result in a valid JSON object after cleaning.");
      }
      console.log("ESQueryBuilderTool: Successfully parsed LLM response into query object.");

    } catch (initialError: any) {
      console.warn("ESQueryBuilderTool: Initial JSON parsing failed.", initialError.message);
      console.log("ESQueryBuilderTool: Problematic string for QueryBuilder (first 200 chars):", llmResponseString.substring(0,200));
      
      const retryAttempted = false; // Conceptual retry placeholder
      let retryError: any = null;

      if (false) { // Placeholder for actual retry logic
        // Conceptual: make another LLM call with a corrective prompt
        // const correctivePrompt = `The previous JSON for an Elasticsearch query was malformed: "${llmResponseString.substring(0,500)}...". Please correct it. Original request context: User Intent: ${JSON.stringify(input.parsedIntent, null, 1)}, Schema Summary: ${input.schemaAnalysis.schemaSummary}. Provide ONLY the valid Elasticsearch DSL JSON.`;
        // ... LLM call logic ...
        // ... parsing and validation of corrected response ...
      }

      if (!retryAttempted || retryError || !output.query) {
          output.errors?.push(`Failed to parse LLM response for query. Initial error: ${initialError.message}. ${retryError ? `Retry error: ${retryError.message}.` : ''} Response snippet: "${llmResponseString.substring(0, 200)}..."`);
          output.query = null;
          output.confidenceScore = 0.1;
          console.error("ESQueryBuilderTool: Final query parsing attempt failed. Error state:", output.errors);
      }
    }
    
    // If there were errors during parsing the intent from a previous step, that should also lower confidence here.
    if (input.parsedIntent.errors && input.parsedIntent.errors.length > 0) {
        output.confidenceScore = (output.confidenceScore || 0.5) * 0.7;
    }
    
    // Ensure warnings/errors are undefined if empty
    if (output.warnings?.length === 0) output.warnings = undefined;
    if (output.errors?.length === 0) output.errors = undefined;

    // Final confidence score adjustment
    output.confidenceScore = parseFloat((output.confidenceScore || 0).toFixed(2));


    return output;
  }
}
