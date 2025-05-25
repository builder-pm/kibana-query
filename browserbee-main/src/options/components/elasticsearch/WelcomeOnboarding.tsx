import React, { useState } from 'react';

export interface WelcomeOnboardingProps {
  onOnboardingComplete: () => void;
  onGoToSettings: () => void;
}

interface OnboardingStep {
  title: string;
  content: React.ReactNode;
  imageUrl?: string;
}

const steps: OnboardingStep[] = [
  {
    title: 'Welcome to Elasticsearch Query Helper!',
    content: (
      <p className="text-gray-600">
        This feature helps you build, understand, and validate Elasticsearch queries right from your browser.
        Let's quickly walk through the main capabilities.
      </p>
    ),
    imageUrl: 'https://www.elastic.co/assets/bltada7771f270d08f6/Dsl-illustration.svg', // Example image
  },
  {
    title: 'Step 1: Configure Your Clusters',
    content: (
      <>
        <p className="text-gray-600 mb-2">
          Before you can start querying, you need to tell BrowserBee how to connect to your Elasticsearch clusters.
        </p>
        <p className="text-gray-600">
          You can add multiple clusters and switch between them easily from the side panel.
        </p>
      </>
    ),
    imageUrl: 'https://www.elastic.co/assets/blt3de4d819d8739c60/icon-cluster.svg', // Example image
  },
  {
    title: 'Step 2: Generate Queries with Natural Language',
    content: (
      <p className="text-gray-600">
        Type your search requests in plain English (e.g., "show all errors from last hour"). BrowserBee will
        translate it into an Elasticsearch DSL query, leveraging schema awareness if available.
      </p>
    ),
    imageUrl: 'https://www.elastic.co/assets/blt2de47a6e80350d00/icon-searchable-snap.svg', // Example image
  },
  {
    title: 'Step 3: Understand and Validate',
    content: (
      <p className="text-gray-600">
        Once a query is generated, you can view its natural language explanation and validate it against your
        cluster's schema to catch potential issues before execution.
      </p>
    ),
    imageUrl: 'https://www.elastic.co/assets/blt8c70533910d8f935/icon-query-workbench.svg', // Example image
  },
  {
    title: 'Ready to Get Started?',
    content: (
      <p className="text-gray-600">
        You can manage your cluster configurations in the settings. Click below to go there now, or complete
        this onboarding to explore later.
      </p>
    ),
  },
];

export const WelcomeOnboarding: React.FC<WelcomeOnboardingProps> = ({
  onOnboardingComplete,
  onGoToSettings,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOnboardingComplete(); // Last step completes onboarding
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-lg transform transition-all duration-300 ease-in-out scale-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{step.title}</h2>
        
        {step.imageUrl && (
          <div className="my-4 flex justify-center">
            <img src={step.imageUrl} alt={step.title} className="h-32 w-auto object-contain" />
          </div>
        )}

        <div className="text-sm mb-6 min-h-[60px]">{step.content}</div>

        {/* Progress Dots */}
        <div className="flex justify-center my-4">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-3 w-3 rounded-full mx-1 focus:outline-none ${
                currentStep === index ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {currentStep === steps.length - 1 ? (
            <div className="space-x-2">
                 <button
                    onClick={onGoToSettings}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                    Go to Settings
                </button>
                <button
                    onClick={onOnboardingComplete}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Finish Onboarding
                </button>
            </div>
          ) : (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
