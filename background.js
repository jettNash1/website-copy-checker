// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize extension data
  chrome.storage.local.set({
    language: 'UK',
    lastResults: null,
    lastUrl: null
  });
});

// Listen for navigation within the same tab
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only handle main frame navigation
  if (details.frameId === 0) {
    // Get the current stored URL
    const { lastUrl } = await chrome.storage.local.get(['lastUrl']);
    
    // Only clear if navigating to a different URL
    if (lastUrl && lastUrl !== details.url) {
      chrome.storage.local.set({
        lastResults: null,
        lastUrl: null
      });
    }
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getLanguage') {
    chrome.storage.local.get(['language'], (result) => {
      sendResponse({ language: result.language || 'UK' });
    });
    return true; // Will respond asynchronously
  }
}); 