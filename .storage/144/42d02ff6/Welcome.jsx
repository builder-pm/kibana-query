import React, { useState } from 'react';

/**
 * Welcome component
 * 
 * Provides an onboarding flow for new users of the Elasticsearch Query Helper extension.
 * Guides users through understanding the functionality and setting up their first connection.
 */
const Welcome = ({ onClose, onAddCluster }) => {
  const [step, setStep] = useState(1);
  const [showSkip, setShowSkip] = useState(true);
  
  // Total number of steps in the onboarding process
  const totalSteps = 4;
  
  const handleNextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
      if (step === totalSteps - 1) {
        setShowSkip(false);
      }
    } else {
      onClose();
    }
  };
  
  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
      setShowSkip(true);
    }
  };
  
  const handleAddCluster = () => {
    onAddCluster();
    onClose();
  };
  
  // Onboarding content by step
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center">
            <div className="mb-8">
              <div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-blue-600 dark:text-blue-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C16.971 3 21 7.029 21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3ZM12 5C8.134 5 5 8.134 5 12C5 15.866 8.134 19 12 19C15.866 19 19 15.866 19 12C19 8.134 15.866 5 12 5ZM11 8V13H15V15H9V8H11Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to Elasticsearch Query Helper
              </h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
                Your AI-powered assistant for writing, understanding, and optimizing Elasticsearch queries.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-blue-600 dark:text-blue-400 mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-medium text-lg mb-1">Natural Language</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Write Elasticsearch queries using plain English
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-blue-600 dark:text-blue-400 mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-medium text-lg mb-1">Validation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically check query syntax and semantics
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="text-blue-600 dark:text-blue-400 mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-medium text-lg mb-1">Optimization</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Get multiple query approaches with explanations
                </p>
              </div>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-4">
                  <span className="text-blue-600 dark:text-blue-300 text-lg font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-1">Connect to Elasticsearch</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Configure your Elasticsearch cluster connection details
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-4">
                  <span className="text-blue-600 dark:text-blue-300 text-lg font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-1">Describe Your Query</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Type what you need in plain English, like "Find logs with error status in the last 24 hours"
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-4">
                  <span className="text-blue-600 dark:text-blue-300 text-lg font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-1">Choose the Best Query</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Review multiple query options, with explanations and validation feedback
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-4">
                  <span className="text-blue-600 dark:text-blue-300 text-lg font-bold">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-lg mb-1">Execute or Export</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Run the query directly or copy it as JSON, cURL, or Kibana format
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example Queries
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mb-2">
                  Basic Search
                </span>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  "Find documents where status is 'error' in the last 24 hours"
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-2">
                  Aggregation
                </span>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  "Show me top 10 users by transaction count"
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 mb-2">
                  Time Series
                </span>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  "Create a time series of login failures by hour"
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 mb-2">
                  Range Filter
                </span>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  "Find products with price between $50 and $100"
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Pro Tip</h3>
              <p className="text-sm text-blue-600 dark:text-blue-200">
                Try to include specific field names, values, and time ranges in your queries for more accurate results. You can also ask for specific aggregation types like terms, stats, or date histograms.
              </p>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="text-center max-w-3xl mx-auto">
            <div className="mb-8">
              <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                You're All Set!
              </h2>
              <p className="text-gray-600 dark:text-gray-300 max-w-lg mx-auto mb-8">
                Let's set up your first Elasticsearch connection to start creating queries
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 mb-8">
              <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Add Your First Connection</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You'll need to configure at least one Elasticsearch cluster connection before using the query helper.
              </p>
              
              <button
                onClick={handleAddCluster}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Configure Elasticsearch
              </button>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              For the demo, you can use mock data without a real connection
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  const renderProgressIndicator = () => {
    return (
      <div className="flex items-center justify-center space-x-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full ${
              index + 1 === step
                ? 'w-8 bg-blue-600 dark:bg-blue-500'
                : index + 1 < step
                ? 'w-4 bg-blue-300 dark:bg-blue-700'
                : 'w-4 bg-gray-200 dark:bg-gray-700'
            }`}
          ></div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl p-6 overflow-hidden">
          {/* Progress indicator */}
          {renderProgressIndicator()}
          
          {/* Content area */}
          <div className="mb-8">
            {renderStepContent()}
          </div>
          
          {/* Navigation buttons */}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={handlePrevStep}
              className={`px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${
                step === 1 ? 'invisible' : ''
              }`}
            >
              Previous
            </button>
            
            <div className="flex space-x-3">
              {showSkip && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Skip Tutorial
                </button>
              )}
              
              <button
                onClick={handleNextStep}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {step === totalSteps ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
