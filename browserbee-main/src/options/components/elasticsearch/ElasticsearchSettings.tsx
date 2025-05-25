import React from 'react';
import { QueryLibraryManagement } from './QueryLibraryManagement';
import { ESConnectionSetup } from './ESConnectionSetup';
import { ESSchemaViewer } from './ESSchemaViewer';

export const ElasticsearchSettings: React.FC = () => {
  return (
    <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800 border-b pb-3">
        Elasticsearch Settings
      </h2>

      {/* Query Library Management Section */}
      <QueryLibraryManagement />

      {/* ESConnectionSetup Section */}
      <div className="mt-6 pt-6 border-t">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Cluster Connections</h3>
        { /* <p className="text-sm text-gray-500 mb-4">
          Configure your Elasticsearch cluster connections here.
        </p> */ }
        <ESConnectionSetup />
      </div>

      {/* ESSchemaViewer Section */}
      <div className="mt-6 pt-6 border-t">
        {/* Title is part of ESSchemaViewer, so not repeating here unless different style needed */}
        <ESSchemaViewer />
      </div>
    </div>
  );
};
