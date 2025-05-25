import { IntentParserInput, ParsedIntent, ExampleQuery } from './types';
// import { ExecutionEngine } from '../../../agent/ExecutionEngine'; // Would be imported if directly using ExecutionEngine

export class ESIntentParserTool {
  // private executionEngine: ExecutionEngine; // LLM interaction service

  // constructor(executionEngine: ExecutionEngine) { // If using direct LLM calls
  //   this.executionEngine = executionEngine;
  // }

  constructor() {
    // Constructor can be empty if not directly taking ExecutionEngine here
    console.log("ESIntentParserTool initialized.");
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
    console.log("ESIntentParserTool: User Prompt constructed (first 200 chars):", userPrompt.substring(0,200));

    // **Conceptual LLM Interaction (Simulated for this subtask)**
    // const llmResponseString = await this.executionEngine.generateText(systemPrompt, userPrompt);
    
    // Simulate LLM response based on input for more dynamic testing
    let simulatedQueryType: 'search' | 'aggregation' | 'mixed' | 'unknown' = 'search';
    const aggregationRequests: any[] = [];
    const entities: any[] = [
        { name: 'keywords', type: 'keyword', value: input.naturalLanguageInput.split(' ').slice(0,2).join(' '), field: 'message_field' }, // Example: take first two words
    ];

    if (input.naturalLanguageInput.toLowerCase().includes("count") || input.naturalLanguageInput.toLowerCase().includes("how many")) {
        entities.push({ name: 'action', type: 'aggregation_trigger', value: 'count' });
    }
    if (input.naturalLanguageInput.toLowerCase().includes("failed logins") || input.naturalLanguageInput.toLowerCase().includes("errors last hour")) {
        entities.push({ name: 'event_type', type: 'filter', value: 'error', field: 'event.outcome' });
    }


    if (input.naturalLanguageInput.toLowerCase().includes("aggregate") || input.naturalLanguageInput.toLowerCase().includes("group by") || input.naturalLanguageInput.toLowerCase().includes("average of")) {
        simulatedQueryType = input.naturalLanguageInput.toLowerCase().includes("find") || input.naturalLanguageInput.toLowerCase().includes("search") ? 'mixed' : 'aggregation';
        let aggField = "example_field.keyword";
        let aggType = "terms";
        if(input.naturalLanguageInput.toLowerCase().includes("average of salary")){
            aggField = "salary";
            aggType = "avg";
        } else if (input.naturalLanguageInput.toLowerCase().includes("group by host")){
            aggField = "host.name.keyword";
        }
        aggregationRequests.push({
            type: aggType,
            field: aggField, 
            name: `agg_on_${aggField.split('.')[0]}`
        });
    }
    
    const simulatedLLMResponse = {
      originalInput: input.naturalLanguageInput,
      queryType: simulatedQueryType,
      entities: entities,
      dateRanges: [
        { field: '@timestamp', range: { gte: 'now-1h', lte: 'now' } }
      ],
      sort: [{ field: '@timestamp', order: 'desc' }],
      aggregationRequests: aggregationRequests,
      confidenceScore: 0.78, // Simulated confidence
      errors: []
    };

    const llmResponseString = JSON.stringify(simulatedLLMResponse);
    console.log("ESIntentParserTool: Simulated LLM Response String:", llmResponseString);

    let parsedIntent: ParsedIntent;

    try {
      const parsedJson = JSON.parse(llmResponseString);
      
      // Basic validation against ParsedIntent structure
      if (typeof parsedJson.originalInput !== 'string' || 
          typeof parsedJson.queryType !== 'string' || 
          !Array.isArray(parsedJson.entities)) {
        throw new Error('Simulated LLM response is missing required fields (originalInput, queryType, entities) or they are of the wrong type.');
      }

      parsedIntent = {
        originalInput: parsedJson.originalInput,
        queryType: parsedJson.queryType as 'search' | 'aggregation' | 'mixed' | 'unknown',
        entities: parsedJson.entities,
        dateRanges: parsedJson.dateRanges || [],
        sort: parsedJson.sort || [],
        aggregationRequests: parsedJson.aggregationRequests || [],
        confidenceScore: parsedJson.confidenceScore !== undefined ? parsedJson.confidenceScore : 0.5, // Default confidence
        errors: parsedJson.errors || [],
      };

      // Further validation for queryType
      const validQueryTypes = ['search', 'aggregation', 'mixed', 'unknown'];
      if (!validQueryTypes.includes(parsedIntent.queryType)) {
        parsedIntent.errors.push(`Invalid queryType: ${parsedIntent.queryType}. Setting to 'unknown'.`);
        parsedIntent.queryType = 'unknown';
      }
      
      console.log("ESIntentParserTool: Successfully parsed simulated LLM response into ParsedIntent object.");

    } catch (error: any) {
      console.error("ESIntentParserTool: Error parsing LLM response or validating structure:", error);
      parsedIntent = {
        originalInput: input.naturalLanguageInput,
        queryType: 'unknown',
        entities: [],
        dateRanges: [],
        sort: [],
        aggregationRequests: [],
        errors: [`Failed to parse or validate LLM response: ${error.message}`],
        confidenceScore: 0.1
      };
    }

    return parsedIntent;
  }
}
