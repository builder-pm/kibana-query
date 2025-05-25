import { 
    ExplanationToolInput, 
    ExplanationToolOutput, 
    ParsedIntent, 
    SchemaAnalysisOutput 
} from './types';
// import { ExecutionEngine } from '../../../agent/ExecutionEngine'; // Would be imported if directly using ExecutionEngine

export class ExplanationTool {
  // private executionEngine: ExecutionEngine;

  // constructor(executionEngine: ExecutionEngine) {
  //   this.executionEngine = executionEngine;
  // }
  constructor() {
    console.log("ExplanationTool initialized.");
  }

  private constructSystemPrompt(): string {
    return `You are an expert at explaining Elasticsearch DSL queries. 
Your task is to describe the given query in simple, natural language. 
Explain what the query searches for, what filters are applied, how results are sorted, and what aggregations are performed, if any.
Be clear and concise.`;
  }

  private constructUserPrompt(input: ExplanationToolInput): string {
    let userPrompt = "Please explain the following Elasticsearch DSL query in simple, natural language.\n\n";

    userPrompt += "=== Elasticsearch Query ===\n";
    userPrompt += `${JSON.stringify(input.query, null, 2)}\n\n`;

    if (input.parsedIntent && input.parsedIntent.originalInput) {
      userPrompt += `=== Original User Request Context ===\n`;
      userPrompt += `This query was likely generated from a user request like: "${input.parsedIntent.originalInput}"\n\n`;
    }

    if (input.schemaAnalysis && input.schemaAnalysis.schemaSummary) {
      userPrompt += `=== Schema Context ===\n`;
      userPrompt += `The query operates on a schema with key fields such as:\n${input.schemaAnalysis.schemaSummary}\n\n`;
    }

    userPrompt += "Provide a clear, concise, and easy-to-understand explanation of what this query does.";
    return userPrompt;
  }

  private _generateSimpleExplanation(query: Record<string, any>): string {
    let explanation = "This query ";
    const parts: string[] = [];

    if (query.query) {
      if (query.query.match_all) {
        parts.push("retrieves all documents");
      } else if (query.query.bool) {
        const boolQuery = query.query.bool;
        const mustClauses = [];
        if (boolQuery.must) {
          boolQuery.must.forEach((m: any) => {
            if(m.match) mustClauses.push(`documents where ${Object.keys(m.match)[0]} matches "${Object.values(m.match)[0]}"`);
            else if(m.term) mustClauses.push(`documents where ${Object.keys(m.term)[0]} is exactly "${Object.values(m.term)[0]}"`);
            else mustClauses.push("specific conditions are met");
          });
        }
        if (mustClauses.length > 0) parts.push(mustClauses.join(" and "));
        
        const filterClauses = [];
        if (boolQuery.filter) {
          boolQuery.filter.forEach((f: any) => {
            if(f.term) filterClauses.push(`${Object.keys(f.term)[0]} is "${Object.values(f.term)[0]}"`);
            else if(f.range) {
                const field = Object.keys(f.range)[0];
                const ops = Object.entries(f.range[field]).map(([op, val]) => `${op.replace('gte', '>=').replace('lte', '<=').replace('gt', '>').replace('lt', '<')} ${val}`).join(', ');
                filterClauses.push(`${field} is ${ops}`);
            }
            else filterClauses.push("specific criteria apply");
          });
        }
        if (filterClauses.length > 0) {
            if(parts.length > 0) parts.push("filtered by " + filterClauses.join(" and "));
            else parts.push("filters documents where " + filterClauses.join(" and "));
        }
        if (parts.length === 0) parts.push("applies boolean logic to find documents");

      } else if (query.query.match) {
        parts.push(`searches for documents where ${Object.keys(query.query.match)[0]} matches "${Object.values(query.query.match)[0]}"`);
      } else if (query.query.term) {
         parts.push(`searches for documents where ${Object.keys(query.query.term)[0]} is exactly "${Object.values(query.query.term)[0]}"`);
      } else {
        parts.push("performs a custom search");
      }
    } else if (Object.keys(query).length === 0 || (Object.keys(query).length === 1 && query.size ===0 && !query.aggs)) {
        return "This is an empty query and will likely return all documents or be used with aggregations not shown.";
    }
     else {
      parts.push("is structured in a custom way without a standard 'query' clause");
    }

    explanation += parts.join(", ");

    if (query.aggs || query.aggregations) {
      const aggs = query.aggs || query.aggregations;
      const aggNames = Object.keys(aggs);
      if (aggNames.length > 0) {
        explanation += `. It also performs aggregations: `;
        const aggTexts = aggNames.map(name => {
          const aggBody = aggs[name];
          const aggType = Object.keys(aggBody)[0];
          const field = aggBody[aggType].field ? ` on field '${aggBody[aggType].field}'` : '';
          return `'${name}' (a ${aggType} aggregation${field})`;
        });
        explanation += aggTexts.join(", ") + ".";
      }
    }

    if (query.sort) {
      const sortParts = (Array.isArray(query.sort) ? query.sort : [query.sort]).map((s: any) => {
        if (typeof s === 'string') return `by ${s}`;
        const field = Object.keys(s)[0];
        const order = typeof s[field] === 'string' ? s[field] : s[field].order || 'asc';
        return `by ${field} in ${order}ending order`;
      });
      explanation += ` The results are sorted ${sortParts.join(", ")}.`;
    }
    
    if (query.size !== undefined) {
        explanation += ` It is configured to return up to ${query.size} results.`;
    }
    if (query.from !== undefined) {
        explanation += ` Results will be skipped by ${query.from} (offset).`;
    }


    if (explanation === "This query ") return "This query is empty or its structure is not recognized by the simple explainer.";
    return explanation.endsWith(".") ? explanation : explanation + ".";
  }

  async execute(input: ExplanationToolInput): Promise<ExplanationToolOutput> {
    const systemPrompt = this.constructSystemPrompt();
    const userPrompt = this.constructUserPrompt(input);

    console.log("ExplanationTool: System Prompt:", systemPrompt);
    console.log("ExplanationTool: User Prompt (first 300 chars):", userPrompt.substring(0, 300));

    // **Conceptual LLM Interaction (Simulated for this subtask)**
    // const llmResponseString = await this.executionEngine.generateText(systemPrompt, userPrompt);

    // Simulate LLM response
    let explanationString = "This query is designed to retrieve information from Elasticsearch.\n";
    explanationString += this._generateSimpleExplanation(input.query); // Use simple generator for now
    
    // Add more detail if intent or schema is present (simulating LLM would use this context)
    if (input.parsedIntent && input.parsedIntent.originalInput) {
        explanationString += `\nIt appears to be based on the user asking for: "${input.parsedIntent.originalInput}".`;
    }
    if (input.schemaAnalysis && input.schemaAnalysis.schemaSummary) {
        explanationString += `\nThe query considers a data structure including fields like ${input.schemaAnalysis.schemaSummary.split('\n').slice(1,3).join(', ').replace(/- /g, '')}...`;
    }


    console.log("ExplanationTool: Simulated Explanation:", explanationString);

    const confidenceScore = 0.75; // Placeholder confidence

    return {
      explanation: explanationString.trim(),
      confidenceScore: confidenceScore,
      errors: undefined, // No errors in simulated path
    };
  }
}
