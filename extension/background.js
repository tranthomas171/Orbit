// background.js

// Helper: Wrap chrome.identity.getAuthToken in a promise.
function getAuthToken(options) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken(options, (token) => {
      if (chrome.runtime.lastError) {
        console.warn("getAuthToken error:", chrome.runtime.lastError.message);
        // Resolve with null if no token exists (instead of rejecting)
        resolve(null);
      } else {
        resolve(token);
      }
    });
  });
}

// Helper: Wrap chrome.identity.removeCachedAuthToken in a promise.
function removeCachedAuthToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      resolve();
    });
  });
}

// Flush all stored data on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("🚀 Extension startup triggered");
  await forceNewAuth();
});

// Also clear data on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log("🔧 Extension installed/updated");
  await forceNewAuth();
  createContextMenus();
});

async function forceNewAuth() {
  try {
    console.log("🧹 Starting fresh auth flow...");

    // Clear extension storage
    console.log("🧹 Clearing local storage...");
    await chrome.storage.local.clear();

    // Remove cached token if it exists
    console.log("🧹 Checking for existing token...");
    const oldToken = await getAuthToken({ interactive: false });
    if (oldToken) {
      console.log("🧹 Found existing token, removing it...");
      await removeCachedAuthToken(oldToken);
      // Also revoke the token from Google
      const response = await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${oldToken}`);
      console.log("🧹 Token revocation response:", response.status);
    }

    // Request a fresh token (this will show the consent screen)
    console.log("🔑 Requesting new token...");
    const token = await getAuthToken({ interactive: true });
    console.log("🔑 New token:", token);

    if (token) {
      // Store the token locally if needed
      await chrome.storage.local.set({ access_token: token });

      // Call the backend login endpoint to set the session.
      const loginResponse = await fetch("http://localhost:3030/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Ensure the session cookie is set
        body: JSON.stringify({ token })
      });
      const loginResult = await loginResponse.json();
      if (loginResponse.ok) {
        console.log("✅ Session created on backend", loginResult);
      } else {
        console.error("❌ Login failed:", loginResult);
      }
      return token;
    }

    console.error("❌ No token received");
    return null;
  } catch (error) {
    console.error("❌ Auth Error:", {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return null;
  }
}

function createContextMenus() {
  // Create parent menu item
  chrome.contextMenus.create({
    id: "sendIntoOrbit",
    title: "Send into Orbit",
    contexts: ["selection", "image", "audio", "page"]
  });

  // Create child menu items
  chrome.contextMenus.create({
    id: "automatically",
    parentId: "sendIntoOrbit",
    title: "Automatically",
    contexts: ["selection", "image", "audio", "page"]
  });

  chrome.contextMenus.create({
    id: "manually",
    parentId: "sendIntoOrbit",
    title: "Manually",
    contexts: ["selection", "image", "audio", "page"]
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    // Get selected content based on context
    const content = await getSelectedContent(info, tab);
    if (!content) return;

    if (info.menuItemId === "manually") {
      // Open popup for manual tagging
      chrome.windows.create(
        {
          url: "tagPopup.html",
          type: "popup",
          width: 400,
          height: 300,
          focused: true
        },
        (window) => {
          // Store content temporarily to be accessed by the popup
          chrome.storage.local.set({
            pendingContent: content,
            sourceTab: tab.id
          });
        }
      );
    } else {
      // Quick save with no tags
      await saveContent(content, []);
    }
  } catch (error) {
    console.error("Save error:", error);
  }
});

async function getSelectedContent(info, tab) {
  const content = {
    type: null,
    data: null,
    source_url: tab.url,
    timestamp: new Date().toISOString()
  };

  if (info.selectionText) {
    content.type = "text";
    content.data = info.selectionText;
  } else if (info.srcUrl) {
    if (info.mediaType === "image") {
      content.type = "image";
      content.data = info.srcUrl;
    } else if (info.mediaType === "audio") {
      content.type = "audio";
      content.data = info.srcUrl;
    }
  } else if (info.pageUrl) {
    content.type = "webpage";
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

async function saveContent(content, tags = []) {
  const response = await fetch("http://localhost:3030/api/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include", // Ensure the session cookie is sent
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
