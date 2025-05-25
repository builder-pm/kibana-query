import React, { useState, ChangeEvent } from 'react';

export const QueryLibraryManagement: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setFeedbackMessage(null); // Clear previous feedback
    } else {
      setSelectedFile(null);
    }
  };

  const handleImportLibrary = () => {
    if (!selectedFile) {
      setFeedbackMessage({ type: 'error', message: 'Please select a JSON file to import.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target && typeof event.target.result === 'string') {
        const fileContent = event.target.result;
        try {
          // Validate if JSON before sending, though QueryLibraryManager should also validate
          JSON.parse(fileContent); 

          chrome.runtime.sendMessage(
            {
              type: 'IMPORT_ES_QUERY_LIBRARY', // Ensure this type matches ESMessageHandler
              payload: { jsonData: fileContent },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error sending message to background script:', chrome.runtime.lastError.message);
                setFeedbackMessage({ type: 'error', message: `Error importing: ${chrome.runtime.lastError.message}` });
                return;
              }
              if (response && response.success) {
                setFeedbackMessage({ type: 'success', message: 'Query library imported successfully!' });
                setSelectedFile(null); // Clear the file input
                // Clear the actual input element value if possible
                const fileInput = document.getElementById('query-library-file-input') as HTMLInputElement;
                if (fileInput) {
                    fileInput.value = '';
                }
              } else {
                setFeedbackMessage({ type: 'error', message: `Failed to import library: ${response?.message || 'Unknown error'}` });
              }
            }
          );
        } catch (e: any) {
          setFeedbackMessage({ type: 'error', message: `Invalid JSON file: ${e.message}` });
        }
      } else {
        setFeedbackMessage({ type: 'error', message: 'Could not read file content.' });
      }
    };
    reader.onerror = () => {
      setFeedbackMessage({ type: 'error', message: 'Error reading file.' });
    };
    reader.readAsText(selectedFile);
  };

  return (
    <div className="p-4 border border-gray-300 rounded-lg shadow-sm mt-4">
      <h3 className="text-lg font-semibold mb-2 text-gray-700">Query Library Management</h3>
      <p className="text-sm text-gray-600 mb-3">
        Import an existing query library from a JSON file. The file should contain an object where keys are categories and values are arrays of queries.
      </p>
      <div className="flex items-center space-x-3">
        <input
          id="query-library-file-input"
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-md file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 file:text-blue-700
                     hover:file:bg-blue-100"
        />
        <button
          onClick={handleImportLibrary}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
          disabled={!selectedFile}
        >
          Import Library
        </button>
      </div>
      {feedbackMessage && (
        <div
          className={`mt-3 p-2 rounded-md text-sm ${
            feedbackMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {feedbackMessage.message}
        </div>
      )}
    </div>
  );
};
