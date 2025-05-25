import React, { useState, FormEvent } from 'react';

interface QueryInputFormProps {
  isProcessing: boolean;
  onSubmit: (query: string) => void;
}

export const QueryInputForm: React.FC<QueryInputFormProps> = ({ isProcessing, onSubmit }) => {
  const [queryText, setQueryText] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!queryText.trim() || isProcessing) return;
    onSubmit(queryText);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-b border-gray-200">
      <label htmlFor="naturalLanguageQuery" className="block text-sm font-medium text-gray-700 mb-1">
        Enter your search request:
      </label>
      <textarea
        id="naturalLanguageQuery"
        name="naturalLanguageQuery"
        rows={3}
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        disabled={isProcessing}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100"
        placeholder="e.g., 'Show me all error logs from the last hour for host server-123'"
      />
      <button
        type="submit"
        disabled={isProcessing || !queryText.trim()}
        className="mt-2 w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Generate Query'}
      </button>
    </form>
  );
};
