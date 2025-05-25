// Extended agent types for Elasticsearch
import { Tool } from '../agent/tools/types';
import { ESConnection, ESSchema, ParsedIntent, QueryPerspective, SampleQuery } from './elasticsearch';

export interface ESAgentContext {
  userInput: string;
  connection: ESConnection;
  schema: ESSchema;
  sampleQueries: SampleQuery[];
  debugMode: boolean;
}

export interface ESToolParams {
  userInput?: string;
  intent?: ParsedIntent;
  perspective?: QueryPerspective;
  query?: any;
  context: ESAgentContext;
}

export interface ESToolResult {
  success: boolean;
  data?: any;
  error?: string;
  reasoning?: string;
}

export interface ESTool extends Tool {
  execute(params: ESToolParams): Promise<ESToolResult>;
}
