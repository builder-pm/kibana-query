import { 
    ExplanationToolInput, 
    ExplanationToolOutput, 
    ParsedIntent, 
    SchemaAnalysisOutput 
} from './types';
import { LLMProvider, ApiStream, StreamChunk } from '../../../models/providers/types'; // Adjusted path

export class ExplanationTool {
  private readonly llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    console.log("ExplanationTool initialized with LLMProvider.");
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
  // _generateSimpleExplanation method is removed as per instructions.

  async execute(input: ExplanationToolInput): Promise<ExplanationToolOutput> {
    const systemPrompt = this.constructSystemPrompt();
    const userPromptString = this.constructUserPrompt(input); // Renamed to avoid conflict

    console.log("ExplanationTool: System Prompt:", systemPrompt);
    console.log("ExplanationTool: User Prompt (first 300 chars):", userPromptString.substring(0, 300));

    const messages = [{ role: 'user' as const, content: userPromptString }];
    
    let accumulatedLLMResponse = "";
    let llmError: string | null = null;

    const output: ExplanationToolOutput = {
        explanation: '',
        errors: [],
        confidenceScore: 0.5 // Default confidence
    };

    try {
      const stream: ApiStream = this.llmProvider.createMessage(systemPrompt, messages); // No tools passed
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          accumulatedLLMResponse += chunk.text;
        }
      }
    } catch (error: any) {
      console.error("Error during LLM call in ExplanationTool:", error);
      llmError = error.message || "LLM call failed";
    }

    const llmResponseString = accumulatedLLMResponse;
    console.log("ExplanationTool: Actual LLM Response String:", llmResponseString);

    if (llmError || !llmResponseString.trim()) {
      output.errors?.push(llmError || "LLM response was empty.");
      output.explanation = "Could not generate explanation due to an error or empty LLM response.";
      output.confidenceScore = 0.1;
      if (output.errors?.length === 0) output.errors = undefined; // Ensure errors is undefined if no specific error message
      return output;
    }

    output.explanation = llmResponseString.trim();
    // Confidence score could be fixed or adjusted based on response length, presence of keywords, etc.
    // For now, a slightly higher default if response is received.
    output.confidenceScore = 0.8; 

    if (output.errors?.length === 0) output.errors = undefined;

    return output;
  }
}
