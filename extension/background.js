// Flush all stored data on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension startup triggered');
  await forceNewAuth();
});

// Also clear data on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🔧 Extension installed/updated');
  await forceNewAuth();
});

async function forceNewAuth() {
  try {
    console.log('🧹 Starting fresh auth flow...');

    // Clear our storage
    console.log('🧹 Clearing local storage...');
    await chrome.storage.local.clear();

    // Remove token from Chrome's identity system
    console.log('🧹 Removing cached token from Chrome...');
    const oldToken = await chrome.identity.getAuthToken({ interactive: false });
    if (oldToken) {
      console.log('🧹 Found existing token, removing it...');
      await chrome.identity.removeCachedAuthToken({ token: oldToken.token });
      // Also revoke it from Google
      const response = await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${oldToken.token}`);
      console.log('🧹 Token revocation response:', response.status);
    }

    // Now get a fresh token - this should show the consent screen
    console.log('🔑 Requesting new token...');
    const authResult = await chrome.identity.getAuthToken({ 
      interactive: true 
    });

    console.log('🔑 New auth result:', authResult);

    if (authResult?.token) {
      await chrome.storage.local.set({ 
        access_token: authResult.token,
        granted_scopes: authResult.scopes 
      });
      console.log('✅ New token stored');
      return authResult.token;
    }

    console.error('❌ No token received');
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
// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'quickSave',
    title: 'Quick Save',
    contexts: ['selection', 'image', 'video', 'audio', 'page']
  });

  chrome.contextMenus.create({
    id: 'manualSave',
    title: 'Manual Save',
    contexts: ['selection', 'image', 'video', 'audio', 'page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const token = await chrome.storage.local.get('access_token');
    if (!token.access_token) {
      console.error('No auth token found');
      return;
    }

    // Get selected content based on context
    const content = await getSelectedContent(info, tab);
    if (!content) return;

    if (info.menuItemId === 'manualSave') {
      // Open popup for manual tagging
      chrome.windows.create({
        url: 'tagPopup.html',
        type: 'popup',
        width: 400,
        height: 300,
        focused: true
      }, (window) => {
        // Store content temporarily to be accessed by popup
        chrome.storage.local.set({
          pendingContent: content,
          sourceTab: tab.id
        });
      });
    } else {
      // Quick save with no tags
      await saveContent(content, [], token.access_token);
    }
  } catch (error) {
    console.error('Save error:', error);
  }
});

async function getSelectedContent(info, tab) {
  const content = {
    type: null,
    data: null,
    source_url: tab.url,
    timestamp: new Date().toISOString()
  };

  // Handle different types of selected content
  if (info.selectionText) {
    content.type = 'text';
    content.data = info.selectionText;
  } else if (info.srcUrl) {
    if (info.mediaType === 'image') {
      content.type = 'image';
      content.data = info.srcUrl;
    } else if (info.mediaType === 'video') {
      content.type = 'video';
      content.data = info.srcUrl;
    } else if (info.mediaType === 'audio') {
      content.type = 'audio';
      content.data = info.srcUrl;
    }
  } else if (info.pageUrl) {
    content.type = 'webpage';
    // Inject content script to get page content
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return {
          title: document.title,
          content: document.body.innerText,
          html: document.documentElement.outerHTML
        };
      }
    });
    content.data = result;
  }

  return content;
}

async function saveContent(content, tags = [], token) {
  const response = await fetch('http://localhost:3030/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      content,
      tags
    })
  });

  if (!response.ok) {
    throw new Error(`Save failed: ${response.statusText}`);
  }

  return response.json();
}