// src/components/QueryResultCard.jsx
import React, { useState } from 'react';

const QueryResultCard = ({ result, onCopy, onFeedback }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(3);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('json');

  const handleCopy = () => {
    onCopy(selectedFormat);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    onFeedback({
      rating: feedbackRating,
      comment: feedbackComment
    });
    setShowFeedback(false);
    setFeedbackComment('');
  };

  const formatQuery = () => {
    if (selectedFormat === 'curl') {
      // Format as cURL command
      const queryJson = JSON.stringify(result.query);
      return `curl -X POST "localhost:9200/_search" -H 'Content-Type: application/json' -d'\n${JSON.stringify(result.query, null, 2)}\n'`;
    } else if (selectedFormat === 'kibana') {
      // Format for Kibana Dev Tools
      return `GET _search\n${JSON.stringify(result.query, null, 2)}`;
    } else {
      // Default JSON format
      return JSON.stringify(result.query, null, 2);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Card Header */}
      <div className="bg-gray-50 p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg">{result.perspective.name}</h3>
            <div className="flex items-center mt-1">
              <div className="text-sm text-gray-600">{result.perspective.description}</div>
              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {Math.round(result.perspective.confidence * 100)}% confidence
              </span>
            </div>
          </div>
          
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Query Display */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-gray-700">Query:</div>
          
          <div className="flex items-center space-x-2">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="json">JSON</option>
              <option value="curl">cURL</option>
              <option value="kibana">Kibana</option>
            </select>
            
            <button
              onClick={handleCopy}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded"
            >
              {copySuccess ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        
        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-auto max-h-60">
          {formatQuery()}
        </pre>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t">
          {/* Validation Results */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Validation Results:</h4>
            
            {result.validation.errors.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-red-600 mb-1">Errors:</div>
                <ul className="list-disc pl-5 text-xs text-red-600">
                  {result.validation.errors.map((error, i) => (
                    <li key={i}>{error.message}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {result.validation.warnings.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-orange-600 mb-1">Warnings:</div>
                <ul className="list-disc pl-5 text-xs text-orange-600">
                  {result.validation.warnings.map((warning, i) => (
                    <li key={i}>{warning.message}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {result.validation.improvements.length > 0 && (
              <div>
                <div className="text-xs font-medium text-blue-600 mb-1">Suggestions:</div>
                <ul className="list-disc pl-5 text-xs text-blue-600">
                  {result.validation.improvements.map((improvement, i) => (
                    <li key={i}>{improvement.message}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {result.validation.errors.length === 0 && 
             result.validation.warnings.length === 0 && 
             result.validation.improvements.length === 0 && (
              <div className="text-xs text-green-600">
                No issues found with this query.
              </div>
            )}
          </div>
          
          {/* Reasoning */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-1">Reasoning:</h4>
            <p className="text-xs text-gray-600">{result.reasoning}</p>
          </div>
          
          {/* Feedback Section */}
          {!showFeedback ? (
            <button
              onClick={() => setShowFeedback(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Provide feedback on this query
            </button>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="text-sm">
              <h4 className="font-semibold mb-2">Your Feedback:</h4>
              
              <div className="mb-3">
                <div className="text-xs mb-1">Rating:</div>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFeedbackRating(rating)}
                      className={`w-8 h-8 rounded-full ${
                        rating <= feedbackRating 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200'
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-3">
                <div className="text-xs mb-1">Comments:</div>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded"
                  rows={3}
                  placeholder="What worked well or could be improved about this query?"
                ></textarea>
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Submit Feedback
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeedback(false)}
                  className="px-3 py-1 border text-xs rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default QueryResultCard;
