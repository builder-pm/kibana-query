// Test script to validate sidepanel extension components
// Run this in the browser console when the extension is loaded

console.log('🧪 Testing Elasticsearch Query Helper Side Panel Extension...');

// Test 1: Check if extension is loaded
async function testExtensionLoaded() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('✅ Chrome extension API available');
      return true;
    } else {
      console.log('❌ Chrome extension API not available');
      return false;
    }
  } catch (error) {
    console.log('❌ Error accessing Chrome API:', error);
    return false;
  }
}

// Test 2: Check sidepanel API availability
async function testSidePanelAPI() {
  try {
    if (typeof chrome.sidePanel !== 'undefined') {
      console.log('✅ Chrome sidePanel API available');
      return true;
    } else {
      console.log('❌ Chrome sidePanel API not available (requires Chrome 114+)');
      return false;
    }
  } catch (error) {
    console.log('❌ Error accessing sidePanel API:', error);
    return false;
  }
}

// Test 3: Test message passing
async function testMessagePassing() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' });
    if (response && response.tab) {
      console.log('✅ Message passing working - Current tab:', response.tab.title);
      return true;
    } else {
      console.log('❌ Message passing failed or no response');
      return false;
    }
  } catch (error) {
    console.log('❌ Error in message passing:', error);
    return false;
  }
}

// Test 4: Check storage permissions
async function testStorageAccess() {
  try {
    await chrome.storage.local.set({ test: 'sidepanel_test' });
    const result = await chrome.storage.local.get(['test']);
    if (result.test === 'sidepanel_test') {
      console.log('✅ Storage access working');
      await chrome.storage.local.remove(['test']); // Cleanup
      return true;
    } else {
      console.log('❌ Storage access failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Error accessing storage:', error);
    return false;
  }
}

// Test 5: Test sidepanel opening
async function testSidePanelOpen() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.sidePanel.open({ tabId: tabs[0].id });
      console.log('✅ Side panel opened successfully');
      return true;
    } else {
      console.log('❌ No active tab found');
      return false;
    }
  } catch (error) {
    console.log('❌ Error opening side panel:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting Extension Tests...\n');
  
  const tests = [
    { name: 'Extension Loaded', fn: testExtensionLoaded },
    { name: 'SidePanel API', fn: testSidePanelAPI },
    { name: 'Message Passing', fn: testMessagePassing },
    { name: 'Storage Access', fn: testStorageAccess },
    { name: 'SidePanel Open', fn: testSidePanelOpen }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error);
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Extension is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the issues above.');
  }
}

// Auto-run tests if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  runAllTests();
} else {
  console.log('⚠️ Run this script in an extension context (background script, side panel, etc.)');
}

// Export for manual testing
window.extensionTests = {
  runAllTests,
  testExtensionLoaded,
  testSidePanelAPI,
  testMessagePassing,
  testStorageAccess,
  testSidePanelOpen
};
