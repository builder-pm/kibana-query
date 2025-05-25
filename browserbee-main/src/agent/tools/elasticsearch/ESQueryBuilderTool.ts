import { ParsedIntent, SchemaAnalysisOutput, ExampleQuery, QueryBuilderInput, QueryBuilderOutput } from './types';
// import { ExecutionEngine } from '../../../agent/ExecutionEngine'; // Would be imported if directly using ExecutionEngine

export class ESQueryBuilderTool {
  // private executionEngine: ExecutionEngine;

  // constructor(executionEngine: ExecutionEngine) {
  //   this.executionEngine = executionEngine;
  // }
  constructor() {
    console.log("ESQueryBuilderTool initialized.");
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
    let queryClauseUsed = false; // To track if any specific query clauses are added

    parsedIntent.entities.forEach(entity => {
      const fieldInfo = schemaAnalysis.fieldIndex && entity.field ? schemaAnalysis.fieldIndex[entity.field] : undefined;
      let targetField = entity.field;

      if (!targetField && (entity.type === 'keyword' || entity.type === 'search_term')) {
        // Heuristic: if a common text field like 'message', 'content', or any 'text' type field exists, prefer it over _all
        const commonTextField = schemaAnalysis.analyzedFields.find(f => 
            f.fieldName === 'message' || f.fieldName === 'content' || (f.type === 'text' && !f.fieldName.includes('.'))
        );
        targetField = commonTextField ? commonTextField.fieldName : '_all'; // Default to _all if no better candidate
      }
      
      if (!targetField) { // If still no target field (e.g. for non-keyword filters without a field)
          console.warn(`Skipping entity ${entity.name} as no target field could be determined.`);
          return; // Skip this entity
      }


      if (entity.type === 'keyword' || entity.type === 'search_term') {
        esQuery.query.bool.must.push({ match: { [targetField]: entity.value } });
        queryClauseUsed = true;
      } else if (entity.type === 'filter') {
        if (fieldInfo && (fieldInfo.type === 'long' || fieldInfo.type === 'integer' || fieldInfo.type === 'double' || fieldInfo.type === 'float' || fieldInfo.type === 'date')) {
            if (typeof entity.value === 'object' && (entity.value.gte || entity.value.lte || entity.value.gt || entity.value.lt) ) {
                 esQuery.query.bool.filter.push({ range: { [targetField]: entity.value } });
            } else {
                 esQuery.query.bool.filter.push({ term: { [targetField]: entity.value } });
            }
        } else {
            // Default to term filter for keywords, boolean, etc.
            // Use .keyword for text fields if available and intent is exact match
            const keywordField = fieldInfo && fieldInfo.type === 'text' ? `${targetField}.keyword` : targetField;
            // Check if schemaAnalysis.fieldIndex has this keywordField
            const finalTargetField = schemaAnalysis.fieldIndex && schemaAnalysis.fieldIndex[keywordField] ? keywordField : targetField;
            esQuery.query.bool.filter.push({ term: { [finalTargetField]: entity.value } });
        }
        queryClauseUsed = true;
      }
    });

    parsedIntent.dateRanges?.forEach(dateRange => {
      esQuery.query.bool.filter.push({ range: { [dateRange.field]: { ...dateRange.range } } });
      queryClauseUsed = true;
    });
    
    // Cleanup empty boolean clauses
    if (esQuery.query.bool.must.length === 0) delete esQuery.query.bool.must;
    if (esQuery.query.bool.filter.length === 0) delete esQuery.query.bool.filter;
    if (esQuery.query.bool.should.length === 0) delete esQuery.query.bool.should;
    if (esQuery.query.bool.must_not.length === 0) delete esQuery.query.bool.must_not;
    if (Object.keys(esQuery.query.bool).length === 0) delete esQuery.query.bool;


    if (parsedIntent.queryType === 'aggregation' || (parsedIntent.aggregationRequests && parsedIntent.aggregationRequests.length > 0)) {
        esQuery.aggs = {};
        parsedIntent.aggregationRequests?.forEach(agg => {
            const aggBody: Record<string, any> = { ...agg.settings };
            if (agg.field) { // Not all aggregations require a field (e.g. filter aggregation)
                aggBody.field = agg.field;
            }
            // Example: Add default precision_threshold for cardinality if not specified
            if (agg.type === 'cardinality' && (!agg.settings || agg.settings.precision_threshold === undefined)) {
                aggBody.precision_threshold = 3000; 
            }
            esQuery.aggs[agg.name] = { [agg.type]: aggBody };
        });
        
        if (!queryClauseUsed && Object.keys(esQuery.query).length === 0) {
            delete esQuery.query; 
            esQuery.size = 0; 
        } else if (Object.keys(esQuery.query).length > 0 && parsedIntent.queryType === 'aggregation' && !queryClauseUsed) {
            // If it's purely an aggregation intent but bool clause is empty, make it match_all
            if (!esQuery.query.bool || Object.keys(esQuery.query.bool).length === 0) {
                esQuery.query = { match_all: {} };
            }
        }
    }


    if (parsedIntent.sort && parsedIntent.sort.length > 0) {
        esQuery.sort = parsedIntent.sort.map(s => ({ [s.field]: { order: s.order } }));
    }
    
    if (!queryClauseUsed && !(esQuery.aggs && Object.keys(esQuery.aggs).length > 0 && !esQuery.query) && Object.keys(esQuery.query).length === 0) {
      return { query: { match_all: {} } };
    }
    
    // If the top-level query object is now empty (e.g. bool was deleted, no aggs, no sort) default to match_all
    if (Object.keys(esQuery.query).length === 0 && !esQuery.aggs && !esQuery.sort) {
        return { query: { match_all: {} } };
    }


    return esQuery;
  }


  async execute(input: QueryBuilderInput): Promise<QueryBuilderOutput> {
    const systemPrompt = this.constructSystemPrompt();
    const userPrompt = this.constructUserPrompt(input);

    console.log("ESQueryBuilderTool: System Prompt:", systemPrompt);
    console.log("ESQueryBuilderTool: User Prompt (first 300 chars):", userPrompt.substring(0, 300));

    // **Conceptual LLM Interaction (Simulated for this subtask)**
    // const llmResponseString = await this.executionEngine.generateText(systemPrompt, userPrompt);

    // Simulate LLM response: Build a simple query based on intent for more dynamic testing
    const simulatedQueryObject = this.buildSimpleQuery(input.parsedIntent, input.schemaAnalysis);
    const llmResponseString = JSON.stringify(simulatedQueryObject, null, 2); // Pretty print for readability
    
    console.log("ESQueryBuilderTool: Simulated DSL Query String:", llmResponseString);

    let generatedQuery: Record<string, any> | null = null;
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidenceScore: number = 0.8; // Default simulated confidence

    try {
      generatedQuery = JSON.parse(llmResponseString);

      if (generatedQuery && typeof generatedQuery === 'object') {
        const hasQueryKey = Object.prototype.hasOwnProperty.call(generatedQuery, 'query');
        const hasAggsKey = Object.prototype.hasOwnProperty.call(generatedQuery, 'aggs');
        
        if (!hasQueryKey && !hasAggsKey) {
          // Allow if other top-level keys like sort, size, from are present
          const hasOtherKeys = ['sort', 'size', 'from', '_source', 'fields', 'script_fields', 'highlight', 'rescore', 'explain', 'version', 'seq_no_primary_term', 'stats', 'timeout', 'terminate_after', 'profile', 'pit', 'runtime_mappings', 'search_after', 'min_score', 'track_scores', 'track_total_hits', 'indices_boost'].some(key => Object.prototype.hasOwnProperty.call(generatedQuery, key));
          if (!hasOtherKeys) {
            warnings.push("Generated query does not have a top-level 'query' or 'aggs' key, nor other common top-level Elasticsearch keys. This might indicate an issue.");
            confidenceScore *= 0.7;
          }
        }
        if(input.parsedIntent.queryType === 'search' && !hasQueryKey && hasAggsKey && !Object.prototype.hasOwnProperty.call(generatedQuery, 'size')){
            warnings.push("Intent was 'search' but only 'aggs' key found in query without 'size:0' or an explicit query clause. Results might be unexpected.");
            confidenceScore *= 0.8;
        }
        if(input.parsedIntent.queryType === 'aggregation' && hasQueryKey && !hasAggsKey){
            warnings.push("Intent was 'aggregation' but only 'query' key found, no 'aggs'. The query might not perform aggregations as expected.");
            confidenceScore *= 0.8;
        }

      } else {
        throw new Error("LLM response was not a valid JSON object.");
      }

    } catch (e: any) {
      console.error("ESQueryBuilderTool: Error parsing LLM response:", e);
      errors.push(`Failed to parse LLM response as JSON: ${e.message}`);
      generatedQuery = null;
      confidenceScore = 0.1;
    }
    
    // Adjust confidence based on intent's confidence
    confidenceScore = (input.parsedIntent.confidenceScore || 0.6) * confidenceScore;
    // If there were errors during parsing the intent, that should also lower confidence here.
    if (input.parsedIntent.errors && input.parsedIntent.errors.length > 0) {
        confidenceScore *= 0.7;
    }


    return {
      query: generatedQuery,
      queryId: `simulated-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, // Placeholder ID
      confidenceScore: parseFloat(confidenceScore.toFixed(2)),
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
