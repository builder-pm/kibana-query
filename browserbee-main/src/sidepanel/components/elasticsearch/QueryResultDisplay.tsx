import React, { useState, useRef } from 'react';
import { GenerateQueryResult, ValidationResultItem } from '../../../agent/elasticsearch/types';
import { ESClusterConfig } from '../../../services/elasticsearch/types'; // Import ESClusterConfig

interface QueryResultDisplayProps {
  result: GenerateQueryResult;
  activeCluster: ESClusterConfig | null; // Added activeCluster prop
  // onExecuteQuery?: (queryId: string) => void; // Placeholder
  // onProvideFeedback?: (feedback: any) => void; // Placeholder
}

export const QueryResultDisplay: React.FC<QueryResultDisplayProps> = ({ result, activeCluster }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({}); 
  const queryRef = useRef<HTMLPreElement>(null);

  const handleCopyToClipboard = async (text: string, type: string) => {
    if (!text) {
        setCopyStatus({ ...copyStatus, [type]: 'Nothing to copy' });
        setTimeout(() => setCopyStatus(prev => ({...prev, [type]: ''})), 2000);
        return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus({ ...copyStatus, [type]: 'Copied!' });
      setTimeout(() => setCopyStatus(prev => ({...prev, [type]: ''})), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyStatus({ ...copyStatus, [type]: 'Failed to copy' });
       setTimeout(() => setCopyStatus(prev => ({...prev, [type]: ''})), 2000);
    }
  };

  const getCurlCommand = (): string => {
    if (!activeCluster) {
      return `# Cannot generate cURL: No active Elasticsearch cluster selected.\n# Query: \n${JSON.stringify(result.query, null, 2)}`;
    }
    if (!result.query) {
        return `# Cannot generate cURL: Query is null.`;
    }

    const { protocol, host, port, auth } = activeCluster;
    const baseUrl = `${protocol}://${host}:${port}`;
    
    // Try to infer index from parsedIntent or schemaSummary, fallback to generic _search
    let path = '/_search'; // Default path
    if (result.parsedIntent?.entities?.some(e => e.type === 'index_pattern' && e.value)) {
        const indexEntity = result.parsedIntent.entities.find(e => e.type === 'index_pattern' && e.value);
        path = `/${indexEntity!.value}/_search`;
    } else if (result.schemaSummary?.startsWith("Schema for:")){ // Heuristic if schemaSummary contains index name
        const match = result.schemaSummary.match(/Schema for: (\S+)/);
        if (match && match[1]){
            path = `/${match[1]}/_search`;
        }
    }


    let authPart = '';
    if (auth.type === 'basic' && auth.username && auth.password) {
      authPart = `-u "${auth.username}:${auth.password}" `;
    }
    // Note: API Key for cURL often means setting a 'Authorization: ApiKey <base64_encoded_key>' header.
    // This simplified version only includes basic auth. A more complex setup would handle ApiKey header.

    return `curl -X POST "${baseUrl}${path}" ${authPart}-H "Content-Type: application/json" -d'\n${JSON.stringify(result.query, null, 2)}\n'`;
  };
  
  const getKibanaDevToolsCommand = (): string => {
    if (!result.query) return "";
    return `POST /your_index/_search\n${JSON.stringify(result.query, null, 2)}`;
  };

  if (!result || !result.query) {
    return (
      <div className="p-4 my-3 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm">
        <p className="text-sm text-yellow-700">No query result to display or query is null.</p>
         {result?.errors && result.errors.length > 0 && (
          <div className="mt-2">
            <h4 className="text-xs font-semibold text-red-700">Errors:</h4>
            <ul className="list-disc list-inside text-xs text-red-600">
              {result.errors.map((err, idx) => (
                <li key={idx}>{err.step}: {err.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  
  const { query, explanation, validationResults, isValid, confidence, queryId, errors: generationErrors } = result;

  return (
    <div className="p-4 my-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800">
          Generated Query {queryId && <span className="text-xs text-gray-500">(ID: {queryId})</span>}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {isExpanded ? 'Collapse' : 'Expand Details'}
        </button>
      </div>

      {/* Confidence Scores */}
      {confidence && (
        <div className="mb-2 text-xs text-gray-600">
          Confidence: 
          {confidence.intent !== undefined && ` Intent (${(confidence.intent * 100).toFixed(0)}%)`}
          {confidence.builder !== undefined && ` | Builder (${(confidence.builder * 100).toFixed(0)}%)`}
          {confidence.explanation !== undefined && ` | Explanation (${(confidence.explanation * 100).toFixed(0)}%)`}
        </div>
      )}
      
      {/* Query Display */}
      <div className="relative bg-gray-900 text-white p-3 rounded-md text-sm">
        <pre ref={queryRef} className="overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(query, null, 2)}
        </pre>
        <div className="absolute top-2 right-2 flex space-x-1">
          <button onClick={() => handleCopyToClipboard(JSON.stringify(query, null, 2), 'json')} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">{copyStatus.json || 'JSON'}</button>
          <button onClick={() => handleCopyToClipboard(getCurlCommand(), 'curl')} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">{copyStatus.curl || 'cURL'}</button>
          <button onClick={() => handleCopyToClipboard(getKibanaDevToolsCommand(), 'kibana')} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">{copyStatus.kibana || 'Kibana'}</button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Explanation */}
          {explanation && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700">Explanation:</h4>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{explanation}</p>
            </div>
          )}

          {/* Validation Results */}
          {validationResults && validationResults.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700">
                Validation: <span className={`${isValid ? 'text-green-600' : 'text-red-600'}`}>{isValid ? 'Valid' : 'Errors Found'}</span>
              </h4>
              <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                {validationResults.map((vr: ValidationResultItem, idx: number) => (
                  <li key={idx} className={`${vr.type === 'error' ? 'text-red-600' : vr.type === 'warning' ? 'text-yellow-600' : 'text-blue-500'}`}>
                    <strong>{vr.type.toUpperCase()}:</strong> {vr.message} {vr.fieldPath && `(Path: ${vr.fieldPath})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Generation Errors (if any during the process) */}
          {generationErrors && generationErrors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-700">Generation Process Errors:</h4>
              <ul className="list-disc list-inside text-xs text-red-600">
                 {generationErrors.map((err, idx) => (
                    <li key={idx}><strong>Step: {err.step}</strong> - {err.message}</li>
                ))}
              </ul>
            </div>
           )}
        </div>
      )}

      {/* Action Buttons (Placeholders) */}
      <div className="mt-4 flex space-x-2">
        <button 
            // onClick={() => onExecuteQuery && queryId && onExecuteQuery(queryId)} 
            className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            disabled={true} // For now
        >
            Execute Query (Not Implemented)
        </button>
        <button 
            // onClick={() => onProvideFeedback && onProvideFeedback({})}
            className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
            disabled={true} // For now
        >
            Provide Feedback (Not Implemented)
        </button>
      </div>
    </div>
  );
};
