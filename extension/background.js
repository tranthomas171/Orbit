// background.js
const DASHBOARD_URL = 'http://localhost:3000'; // Change this to your dashboard URL
const API_ENDPOINT = 'http://localhost:5000/api/save'; // Change this to your API endpoint

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
    // Text selection
    chrome.contextMenus.create({
      id: 'saveText',
      title: 'Save Text to ORBIT',
      contexts: ['selection']
    });
  
    // Image selection
    chrome.contextMenus.create({
      id: 'saveImage',
      title: 'Save Image to ORBIT',
      contexts: ['image']
    });
  
    // Video selection
    chrome.contextMenus.create({
      id: 'saveVideo',
      title: 'Save Video to ORBIT',
      contexts: ['video']
    });
  
    // Link selection
    chrome.contextMenus.create({
      id: 'saveLink',
      title: 'Save Link to ORBIT',
      contexts: ['link']
    });
  
    // Page selection
    chrome.contextMenus.create({
      id: 'savePage',
      title: 'Save Page to ORBIT',
      contexts: ['page']
    });
  });
  
  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    let data = {
      type: '',
      content: '',
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString()
    };
  
    switch (info.menuItemId) {
      case 'saveText':
        data.type = 'text';
        data.content = info.selectionText;
        break;
      case 'saveImage':
        data.type = 'image';
        data.content = info.srcUrl;
        break;
      case 'saveVideo':
        data.type = 'video';
        data.content = info.srcUrl;
        break;
      case 'saveLink':
        data.type = 'link';
        data.content = info.linkUrl;
        break;
      case 'savePage':
        data.type = 'page';
        data.content = tab.url;
        // Capture the whole page content
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => document.documentElement.outerHTML
        }, (result) => {
          data.content = result[0].result;
          sendToBackend(data);
        });
        return;
    }
  
    sendToBackend(data);
  });
  
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
  