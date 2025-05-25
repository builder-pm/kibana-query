import React, { useState, useRef } from 'react';

/**
 * QueryResultCard component
 * 
 * Displays a generated Elasticsearch query result with syntax highlighting,
 * copy functionality, execution options, and explanations.
 */
const QueryResultCard = ({ result, onExecute, onFeedback }) => {
  const [expanded, setExpanded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('helpful');
  const queryRef = useRef(null);

  // Format the query JSON with proper indentation
  const formattedQuery = JSON.stringify(result.query, null, 2);

  // Handle copying to clipboard
  const handleCopy = (format) => {
    let textToCopy = '';
    
    switch (format) {
      case 'json':
        textToCopy = formattedQuery;
        break;
      case 'curl':
        // Format as curl command
        textToCopy = `curl -X GET "http://localhost:9200/_search" -H 'Content-Type: application/json' -d '\n${formattedQuery}\n'`;
        break;
      case 'kibana':
        // Format for Kibana Dev Tools
        textToCopy = `GET _search\n${formattedQuery}\n`;
        break;
      default:
        textToCopy = formattedQuery;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopySuccess(format);
        setTimeout(() => setCopySuccess(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  // Handle feedback submission
  const submitFeedback = () => {
    onFeedback({
      type: feedbackType,
      comment: feedbackText,
      timestamp: new Date().toISOString()
    });
    setShowFeedbackForm(false);
    setFeedbackText('');
  };

  return (
    <div className="query-result-card border rounded-lg shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      <div className="bg-gray-50 dark:bg-gray-750 p-3 border-b dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <div className={`w-2 h-6 rounded-sm mr-3 ${
            result.rankingScore > 0.8 ? 'bg-green-500' : 
            result.rankingScore > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {result.perspective.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(result.rankingScore * 100)}% confidence
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-md text-sm ${
              expanded ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 
              'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Query Preview */}
      <div className="p-3">
        <div className="relative">
          <pre
            ref={queryRef}
            className="p-3 bg-gray-800 text-gray-200 rounded-md text-sm overflow-x-auto"
            style={{ maxHeight: expanded ? 'none' : '200px' }}
          >
            <code>{formattedQuery}</code>
          </pre>
          
          {/* Copy buttons overlayed on top right */}
          <div className="absolute top-2 right-2 flex space-x-1 bg-gray-700 bg-opacity-70 rounded-md">
            <button
              onClick={() => handleCopy('json')}
              className="text-xs p-1 text-gray-300 hover:text-white"
              title="Copy JSON"
            >
              {copySuccess === 'json' ? '✓' : 'JSON'}
            </button>
            <button
              onClick={() => handleCopy('curl')}
              className="text-xs p-1 text-gray-300 hover:text-white"
              title="Copy as cURL command"
            >
              {copySuccess === 'curl' ? '✓' : 'cURL'}
            </button>
            <button
              onClick={() => handleCopy('kibana')}
              className="text-xs p-1 text-gray-300 hover:text-white"
              title="Copy for Kibana Dev Tools"
            >
              {copySuccess === 'kibana' ? '✓' : 'Kibana'}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => onExecute(result.id)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
            >
              Execute Query
            </button>
            <button
              onClick={() => setShowFeedbackForm(!showFeedbackForm)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm rounded-md"
            >
              Provide Feedback
            </button>
          </div>
          <div className="text-xs text-gray-500">
            ID: {result.id?.substring(0, 8)}
          </div>
        </div>

        {/* Feedback form */}
        {showFeedbackForm && (
          <div className="mt-3 p-3 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
            <h4 className="text-sm font-medium mb-2">Your feedback helps improve our query generation</h4>
            <div className="flex space-x-4 mb-3">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="feedback-type"
                  value="helpful"
                  checked={feedbackType === 'helpful'}
                  onChange={() => setFeedbackType('helpful')}
                  className="form-radio"
                />
                <span className="ml-2 text-sm">Helpful</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="feedback-type"
                  value="not-helpful"
                  checked={feedbackType === 'not-helpful'}
                  onChange={() => setFeedbackType('not-helpful')}
                  className="form-radio"
                />
                <span className="ml-2 text-sm">Not helpful</span>
              </label>
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Optional: Tell us why this query was helpful or not helpful..."
              className="w-full p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600"
              rows={3}
            ></textarea>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowFeedbackForm(false)}
                className="mr-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t dark:border-gray-700 p-3">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approach</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{result.perspective.approach}</p>
          </div>

          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Explanation</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{result.explanation}</p>
          </div>

          {result.validation && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validation</h4>
              
              {result.validation.warnings && result.validation.warnings.length > 0 && (
                <div className="mb-2">
                  <h5 className="text-xs font-medium text-yellow-700 dark:text-yellow-500">Warnings:</h5>
                  <ul className="list-disc pl-5 text-xs text-yellow-600 dark:text-yellow-400">
                    {result.validation.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.validation.errors && result.validation.errors.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-red-700 dark:text-red-500">Errors:</h5>
                  <ul className="list-disc pl-5 text-xs text-red-600 dark:text-red-400">
                    {result.validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(!result.validation.errors || result.validation.errors.length === 0) && 
              (!result.validation.warnings || result.validation.warnings.length === 0) && (
                <p className="text-sm text-green-600 dark:text-green-400">No validation issues detected</p>
              )}
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recommendations</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QueryResultCard;
