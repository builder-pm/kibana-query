import { IntentParserInput, ParsedIntent, ExampleQuery } from './types';
import { LLMProvider, ApiStream, StreamChunk } from '../../../models/providers/types'; // Adjusted path

export class ESIntentParserTool {
  private readonly llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    console.log("ESIntentParserTool initialized with LLMProvider.");
  }

  private constructSystemPrompt(): string {
    // System prompt as defined in the subtask
    return `You are an expert at understanding user requests for Elasticsearch. 
Your goal is to parse the user's natural language and convert it into a structured JSON object representing their intent. 
Identify entities, filters, date ranges, desired aggregations, and sorting preferences. 
Consider the provided schema summary and example queries for context if available.
Ensure your output strictly adheres to the ParsedIntent JSON interface provided in the user prompt. Do not add any explanatory text before or after the JSON object.`;
  }

  private constructUserPrompt(input: IntentParserInput): string {
    let userPrompt = `Parse the following natural language input into a structured JSON object representing the user's intent for an Elasticsearch query.\n\n`;
    userPrompt += `Natural Language Input: "${input.naturalLanguageInput}"\n\n`;

    if (input.schemaSummary) {
      userPrompt += `Consider the following schema summary for context:\n\`\`\`\n${input.schemaSummary}\n\`\`\`\n\n`;
    }

    if (input.exampleQueries && input.exampleQueries.length > 0) {
      userPrompt += `Here are some examples of how users phrase queries and their corresponding structured intents (note: example 'query' fields are simplified Elasticsearch queries, not full ParsedIntent objects for brevity in this example section):\n`;
      // Limiting to a few examples for brevity in the prompt
      input.exampleQueries.slice(0, 2).forEach(example => {
        userPrompt += `- User: "${example.naturalLanguageQuery || example.description}" -> Example ES Query Fragment: ${JSON.stringify(example.query, null, 2)}\n`;
      });
      userPrompt += `\n`;
    }

    // Instructions for the output format, including the ParsedIntent interface definition
    userPrompt += `Respond ONLY with a single JSON object matching the ParsedIntent interface. The ParsedIntent interface is defined as:
    \`\`\`json
    {
      "originalInput": "string (copy of the naturalLanguageInput)",
      "queryType": "'search' | 'aggregation' | 'mixed' | 'unknown'",
      "entities": [
        { 
          "name": "string (e.g., 'status', 'product_name', 'search_term')", 
          "type": "string (e.g., 'filter', 'keyword', 'geo_location', 'numeric_range')", 
          "value": "any (e.g., 'active', 'laptop', { 'lat': 40.7128, 'lon': -74.0060 }, { 'gte': 100, 'lte': 200 })",
          "field": "string (optional, specific ES field, e.g., 'status.keyword', 'product_name.text', 'price')"
        }
      ],
      "dateRanges": [
        { 
          "field": "string", 
          "range": { 
            "gte": "string (optional, e.g., 'now-7d/d', '2023-01-01')", 
            "lte": "string (optional, e.g., 'now', '2023-12-31')",
            "format": "string (optional, e.g., 'yyyy-MM-dd')"
          } 
        }
      ],
      "sort": [
        { 
          "field": "string", 
          "order": "'asc' | 'desc'" 
        }
      ],
      "aggregationRequests": [
        { 
          "type": "string (e.g., 'terms', 'date_histogram', 'stats', 'avg', 'cardinality')", 
          "field": "string (optional, field to aggregate on)", 
          "name": "string (name for the aggregation result, how it will be keyed in the response)",
          "settings": "any (optional, e.g., { 'interval': 'day' } for date_histogram, { 'size': 10 } for terms)"
        }
      ],
      "confidenceScore": "number (optional, 0-1, how confident the parser is in its interpretation)",
      "errors": ["string (optional, if parsing failed or issues encountered)"]
    }
    \`\`\`
    
    Example of a valid JSON response:
    \`\`\`json
    {
      "originalInput": "${input.naturalLanguageInput}",
      "queryType": "search",
      "entities": [
        {"name": "keywords", "type": "keyword", "value": "error logs", "field": "message"},
        {"name": "source_ip", "type": "filter", "value": "192.168.1.101", "field": "network.source.ip"}
      ],
      "dateRanges": [
        {"field": "@timestamp", "range": {"gte": "now-24h", "lte": "now"}}
      ],
      "sort": [{"field": "@timestamp", "order": "desc"}],
      "aggregationRequests": [],
      "confidenceScore": 0.85,
      "errors": []
    }
    \`\`\`
    
    Now, provide the JSON object for the input: "${input.naturalLanguageInput}"`;
    return userPrompt;
  }

  async execute(input: IntentParserInput): Promise<ParsedIntent> {
    const systemPrompt = this.constructSystemPrompt();
    const userPrompt = this.constructUserPrompt(input);

    console.log("ESIntentParserTool: System Prompt constructed (first 200 chars):", systemPrompt.substring(0,200));
    const userPromptString = this.constructUserPrompt(input);
    console.log("ESIntentParserTool: User Prompt constructed (first 200 chars):", userPromptString.substring(0,200));

    const messages = [{ role: 'user' as const, content: userPromptString }];
    
    let accumulatedLLMResponse = "";
    let llmError: string | null = null;

    try {
      const stream: ApiStream = this.llmProvider.createMessage(systemPrompt, messages); // No tools passed
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          accumulatedLLMResponse += chunk.text;
        }
        // Optional: Handle other chunk types like 'usage' if needed
      }
    } catch (error: any) {
      console.error("Error during LLM call in ESIntentParserTool:", error);
      llmError = error.message || "LLM call failed";
    }

    const llmResponseString = accumulatedLLMResponse;
    console.log("ESIntentParserTool: Actual LLM Response String:", llmResponseString);

    let parsedIntent: ParsedIntent = { // Initialize with defaults in case of early exit
        originalInput: input.naturalLanguageInput,
        queryType: 'unknown',
        entities: [],
        dateRanges: [],
        sort: [],
        aggregationRequests: [],
        errors: [],
        confidenceScore: 0.1
    };

    if (llmError || !llmResponseString.trim()) {
      parsedIntent.errors = [...(parsedIntent.errors || []), llmError || "LLM response was empty."];
      parsedIntent.queryType = 'unknown';
      parsedIntent.confidenceScore = 0.05; // Very low confidence
      console.error("ESIntentParserTool: Error from LLM or empty response.", parsedIntent.errors);
      return parsedIntent;
    }

    try {
      let cleanedResponseString = llmResponseString;

      // 1. Improved Pre-Parsing Cleaning
      // Remove markdown ```json ... ``` wrappers first
      cleanedResponseString = cleanedResponseString.replace(/^```json\s*|```\s*$/g, '').trim();

      // Attempt to extract JSON object if it's embedded
      const firstBrace = cleanedResponseString.indexOf('{');
      const lastBrace = cleanedResponseString.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        // Check if the substring between first and last brace is likely JSON
        const potentialJson = cleanedResponseString.substring(firstBrace, lastBrace + 1);
        try {
          JSON.parse(potentialJson); // Try parsing this substring
          cleanedResponseString = potentialJson; // If it parses, assume this is the intended JSON
          console.log("ESIntentParserTool: Extracted potential JSON block from response.");
        } catch (e) {
          // Not a valid JSON block, or the original string was already fine (or still malformed)
          console.warn("ESIntentParserTool: Could not cleanly extract a JSON block, proceeding with original cleaned string (after markdown removal).");
        }
      }
      
      // At this point, cleanedResponseString is our best guess for the JSON content.
      const parsedJson = JSON.parse(cleanedResponseString);
      
      if (typeof parsedJson.originalInput !== 'string' || 
          typeof parsedJson.queryType !== 'string' || 
          !Array.isArray(parsedJson.entities)) {
        throw new Error('LLM response is missing required fields (originalInput, queryType, entities) or they are of the wrong type.');
      }

      parsedIntent = {
        originalInput: parsedJson.originalInput,
        queryType: parsedJson.queryType as 'search' | 'aggregation' | 'mixed' | 'unknown',
        entities: parsedJson.entities,
        dateRanges: parsedJson.dateRanges || [],
        sort: parsedJson.sort || [],
        aggregationRequests: parsedJson.aggregationRequests || [],
        confidenceScore: parsedJson.confidenceScore !== undefined ? parsedJson.confidenceScore : 0.6, 
        errors: parsedJson.errors || [],
      };

      const validQueryTypes = ['search', 'aggregation', 'mixed', 'unknown'];
      if (!validQueryTypes.includes(parsedIntent.queryType)) {
        parsedIntent.errors.push(`Invalid queryType from LLM: ${parsedIntent.queryType}. Setting to 'unknown'.`);
        parsedIntent.queryType = 'unknown';
      }
      
      console.log("ESIntentParserTool: Successfully parsed LLM response into ParsedIntent object.");

    } catch (initialError: any) {
      console.warn("ESIntentParserTool: Initial JSON parsing failed.", initialError.message);
      console.log("ESIntentParserTool: Problematic string (first 200 chars):", llmResponseString.substring(0,200));

      // **Conceptual Retry Mechanism Placeholder**
      // For now, we'll log that a retry would occur and then proceed to populate error state.
      // In a full implementation, a second LLM call would happen here.
      const retryAttempted = false; // Set to true if actual retry implemented and attempted
      let retryError: any = null;

      if (false) { // Placeholder for actual retry logic: `if (shouldRetry)`
        console.log("ESIntentParserTool: (Conceptual) Attempting LLM call to correct malformed JSON.");
        // const correctivePrompt = `The previous JSON response you provided was malformed: "${llmResponseString.substring(0, 500)}...". Please correct it and provide ONLY the valid JSON object. Original request was to parse: "${input.naturalLanguageInput}"`;
        // try {
        //   let correctedLlmResponse = "";
        //   const correctiveMessages = [{ role: 'user' as const, content: correctivePrompt }];
        //   const stream: ApiStream = this.llmProvider.createMessage(systemPrompt, correctiveMessages);
        //   for await (const chunk of stream) { if (chunk.type === 'text' && chunk.text) correctedLlmResponse += chunk.text; }
        //
        //   const cleanedCorrectedResponse = correctedLlmResponse.replace(/^```json\s*|```\s*$/g, '').trim();
        //   const correctedParsedJson = JSON.parse(cleanedCorrectedResponse);
        //   // Re-validate and assign to parsedIntent if successful... (similar to above try block)
        //   console.log("ESIntentParserTool: (Conceptual) Successfully parsed corrected LLM response.");
        //   // parsedIntent = { ... }
        //   // return parsedIntent; // If successful retry
        // } catch (e) {
        //   retryError = e;
        //   console.error("ESIntentParserTool: (Conceptual) Error parsing corrected LLM response:", retryError);
        // }
      }
      // End Conceptual Retry Mechanism Placeholder

      // If retry was not attempted, or if it was and failed:
      if (!retryAttempted || (retryAttempted && retryError) || (retryAttempted && !parsedIntent.queryType)) { // Check if parsedIntent was successfully populated by retry
          parsedIntent.errors = [
              ...(parsedIntent.errors || []), 
              `Failed to parse LLM response. Initial error: ${initialError.message}. ${retryError ? `Retry error: ${retryError.message}.` : ''} Response snippet: "${llmResponseString.substring(0, 200)}..."`
          ];
          parsedIntent.queryType = 'unknown';
          parsedIntent.confidenceScore = 0.1; // Low confidence due to parsing error
          console.error("ESIntentParserTool: Final parsing attempt failed. Error state:", parsedIntent.errors);
      }
    }
    return parsedIntent;
  }
}
