const DASHBOARD_URL = 'http://localhost:3000';
const API_ENDPOINT = 'http://localhost:3030/api/save';

// Check if user is authenticated
async function isAuthenticated() {
  console.log('🔍 Checking authentication status...');
  const token = await chrome.storage.local.get(['access_token']);
  const hasToken = !!token.token;
  console.log('🔍 Has token:', hasToken);
  return hasToken;
}
async function getAccessToken() {
  console.log('🔑 Getting access token...');
  try {
    const authResult = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    
    console.log('🔑 Auth result structure:', JSON.stringify({
      hasToken: !!authResult?.token,
      hasScopes: !!authResult?.scopes,
      scopes: authResult?.scopes
    }, null, 2));
    
    if (authResult?.token) {
      console.log('🔑 Storing token and scopes...');
      await chrome.storage.local.set({ 
        access_token: authResult.token,
        granted_scopes: authResult.scopes 
      });
      console.log('🔑 Auth data stored successfully');
      return authResult.token;
    }
    
    console.error('❌ No token in auth result');
    return null;
  } catch (error) {
    console.error('❌ Auth Error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return null;
  }
}

async function sendToBackend(data, retryCount = 0) {
  const MAX_RETRIES = 1; // Only retry once to prevent infinite loops
  
  console.log('📤 Sending data to backend... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})');
  try {
    // Check authentication
    let token = await chrome.storage.local.get(['access_token']).token;
    console.log('1. Token retrieved:', token.access_token ? 'Token exists' : 'No token');

    if (!token.access_token) {
      console.log('🔑 No token found, requesting new token...');
      const newToken = await getAccessToken();
      if (!newToken) {
        throw new Error('Failed to get authentication token');
      }
      token.access_token = newToken;
    }

    const requestConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.access_token}`
      },
      body: JSON.stringify(data)
    };

    console.log('4. Attempting fetch...');
    const response = await fetch(API_ENDPOINT, requestConfig);
    console.log('5. Fetch completed');

    if (!response.ok) {
      if (response.status === 401 && retryCount < MAX_RETRIES) {
        console.log('🔑 Token expired, requesting new token...');
        await chrome.storage.local.remove(['access_token']);
        const newToken = await getAccessToken();
        if (!newToken) {
          throw new Error('Failed to refresh authentication token');
        }
        // Retry with new token
        return sendToBackend(data, retryCount + 1);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('6. Response status:', response.status);
    return handleResponseData(response);
  } catch (error) {
    console.error('Detailed error:', JSON.stringify({
      message: error.message,
      stack: error.stack,
      name: error.name,
      fullError: error.toString(),
      retryCount
    }, null, 2));
    throw error;
  }
}

async function handleResponseData(response) {
  const contentLength = response.headers.get('Content-Length');
  if (!contentLength || contentLength === '0') {
    return { status: 'success' };
  }
  
  try {
    return await response.json();
  } catch (error) {
    console.error('Error parsing response:', error);
    return { status: 'success' };
  }
}

// Run auth check on startup and install/update
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension startup triggered');
  const isAuthed = await isAuthenticated();
  if (!isAuthed) {
    console.log('🔑 Not authenticated on startup, getting token...');
    await getAccessToken();
  }
});

// Create context menu items with two options each
chrome.runtime.onInstalled.addListener(() => {
    console.log('🔧 Extension installed/updated');
    const contexts = [
        { id: 'Text', context: 'selection', content: 'selectionText' },
        { id: 'Image', context: 'image', content: 'srcUrl' },
        { id: 'Video', context: 'video', content: 'srcUrl' },
        { id: 'Link', context: 'link', content: 'linkUrl' },
        { id: 'Page', context: 'page', content: 'url' }
    ];

    contexts.forEach(({ id, context }) => {
        // Create parent menu item
        chrome.contextMenus.create({
            id: `save${id}Parent`,
            title: `Send ${id} into Orbit`,
            contexts: [context]
        });

        // Create child menu items
        chrome.contextMenus.create({
            id: `quickSave${id}`,
            parentId: `save${id}Parent`,
            title: 'Quick Save',
            contexts: [context]
        });

        chrome.contextMenus.create({
            id: `taggedSave${id}`,
            parentId: `save${id}Parent`,
            title: 'Save with Tags',
            contexts: [context]
        });
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const isQuickSave = info.menuItemId.startsWith('quickSave');
    const type = info.menuItemId.replace(isQuickSave ? 'quickSave' : 'taggedSave', '').toLowerCase();

    let data = {
        type,
        content: '',
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString(),
        tags: []
    };

    // Set content based on type
    switch (type) {
        case 'text':
            data.content = info.selectionText;
            break;
        case 'image':
        case 'video':
            data.content = info.srcUrl;
            break;
        case 'link':
            data.content = info.linkUrl;
            break;
        case 'page':
            data.content = tab.url;

            // Handle page content separately
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    function: () => document.documentElement.outerHTML
                },
                (result) => {
                    data.content = result[0].result;
                    handleSave(data, isQuickSave, tab.id);
                }
            );
            return;
    }

    handleSave(data, isQuickSave, tab.id);
});

// Handle the save operation
function handleSave(data, isQuickSave, tabId) {
    if (isQuickSave) {
        sendToBackend(data);
    } else {
        // Open popup for tag input
        chrome.windows.create(
            {
                url: 'tagPopup.html',
                type: 'popup',
                width: 400,
                height: 300
            },
            (window) => {
                // Store the data temporarily
                chrome.storage.local.set({ pendingSave: { data, sourceTabId: tabId } });
            }
        );
    }
}