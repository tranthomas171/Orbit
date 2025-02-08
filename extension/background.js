// background.js
const DASHBOARD_URL = 'http://localhost:3000';
const API_ENDPOINT = 'http://localhost:5000/api/save';

// Create context menu items with two options each
chrome.runtime.onInstalled.addListener(() => {
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
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => document.documentElement.outerHTML
      }, (result) => {
        data.content = result[0].result;
        handleSave(data, isQuickSave, tab.id);
      });
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
    chrome.windows.create({
      url: 'tagPopup.html',
      type: 'popup',
      width: 400,
      height: 300
    }, (window) => {
      // Store the data temporarily
      chrome.storage.local.set({
        pendingSave: {
          data,
          sourceTabId: tabId
        }
      });
    });
  }
}

// Send data to backend
function sendToBackend(data) {
  fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(result => {
    // Show success notification
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  })
  .catch(error => {
    console.error('Error:', error);
    // Show error notification
    chrome.action.setBadgeText({ text: '❌' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  });
}