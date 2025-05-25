// Background script for Elasticsearch Query Helper Extension
// Handles sidepanel behavior and communication

console.log('Elasticsearch Query Helper background script loaded');

// Install listener
chrome.runtime.onInstalled.addListener(() => {
  console.log('Elasticsearch Query Helper Extension installed');
  
  // Set panel behavior to open when action icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(error => console.error('Error setting panel behavior:', error));
});

// Handle action icon clicks - open sidepanel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('Action clicked, opening side panel for tab:', tab.id);
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

// Message handler for communication between sidepanel and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'OPEN_SIDE_PANEL':
      chrome.sidePanel.open({ tabId: message.tabId })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Indicates async response
      
    case 'CLOSE_SIDE_PANEL':
      chrome.sidePanel.close({ tabId: message.tabId })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_ACTIVE_TAB':
      chrome.tabs.query({ active: true, currentWindow: true })
        .then(tabs => sendResponse({ success: true, tab: tabs[0] }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'ELASTICSEARCH_QUERY':
      handleElasticsearchQuery(message.payload)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'QUERY_FEEDBACK':
      handleQueryFeedback(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'STORAGE_GET':
      chrome.storage.local.get(message.keys)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'STORAGE_SET':
      chrome.storage.local.set(message.data)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Handle tab updates to maintain sidepanel state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url);
    // You can add logic here to update sidepanel when tab changes
  }
});

// Handle Elasticsearch query execution
async function handleElasticsearchQuery(payload) {
  try {
    const { query, clusterConfig, options } = payload;
    
    console.log('Executing Elasticsearch query:', query);
    console.log('Cluster config:', clusterConfig);
    console.log('Options:', options);
    
    // Simulate query execution for demo purposes
    // In real implementation, this would connect to actual Elasticsearch
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockResults = {
      query: query,
      results: {
        took: 5,
        timed_out: false,
        hits: {
          total: { value: 150, relation: "eq" },
          max_score: 1.0,
          hits: [
            {
              _index: "sample_index",
              _id: "1",
              _score: 1.0,
              _source: {
                title: "Sample Elasticsearch Document",
                content: "This is a sample document matching your query",
                timestamp: new Date().toISOString()
              }
            },
            {
              _index: "sample_index", 
              _id: "2",
              _score: 0.8,
              _source: {
                title: "Another Sample Document",
                content: "Another document that matches the search criteria",
                timestamp: new Date().toISOString()
              }
            }
          ]
        }
      },
      executionTime: '125ms',
      cluster: clusterConfig?.name || 'localhost'
    };
    
    return mockResults;
  } catch (error) {
    console.error('Error executing Elasticsearch query:', error);
    throw new Error(`Query execution failed: ${error.message}`);
  }
}

// Handle query feedback storage
async function handleQueryFeedback(payload) {
  try {
    const { queryId, feedback, comment } = payload;
    
    const feedbackData = {
      queryId,
      feedback,
      comment,
      timestamp: Date.now(),
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Get existing feedback
    const result = await chrome.storage.local.get(['queryFeedback']);
    const existingFeedback = result.queryFeedback || [];
    
    // Add new feedback
    existingFeedback.push(feedbackData);
    
    // Keep only last 100 feedback entries
    if (existingFeedback.length > 100) {
      existingFeedback.splice(0, existingFeedback.length - 100);
    }
    
    // Store updated feedback
    await chrome.storage.local.set({ queryFeedback: existingFeedback });
    
    console.log('Query feedback stored:', feedbackData);
    return feedbackData;
  } catch (error) {
    console.error('Error storing query feedback:', error);
    throw new Error(`Feedback storage failed: ${error.message}`);
  }
}

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
});

// Handle when extension context invalidated
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending');
});
