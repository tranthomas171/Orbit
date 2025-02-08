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
  // Parent menu for non-link contexts
  chrome.contextMenus.create({
    id: "sendIntoOrbit",
    title: "Send into Orbit",
    contexts: ["selection", "image", "audio", "page"]
  });

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

  // For link contexts, add two separate options.
  chrome.contextMenus.create({
    id: "sendLink",
    title: "Send Link into Orbit",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "sendLinkText",
    title: "Send Link Text into Orbit",
    contexts: ["link"]
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    let content;
    // Special handling for link contexts.
    if (info.menuItemId === "sendLink") {
      // Send the link URL as a 'link' type.
      content = {
        type: "link",
        data: info.linkUrl,
        source_url: tab.url,
        timestamp: new Date().toISOString()
      };
    } else if (info.menuItemId === "sendLinkText") {
      // Send the link text as text. If no selection is available, fall back to the URL.
      content = {
        type: "text",
        data: info.selectionText || info.linkUrl,
        source_url: tab.url,
        timestamp: new Date().toISOString()
      };
    } else {
      // For other contexts (text, image, audio, webpage), use your existing helper.
      content = await getSelectedContent(info, tab);
    }
    if (!content) return;

    // If the user selected the "manually" menu option, open the tagging popup.
    if (info.menuItemId === "manually") {
      chrome.windows.create(
        {
          url: "tagPopup.html",
          type: "popup",
          width: 400,
          height: 300,
          focused: true
        },
        (window) => {
          // Store the content temporarily so the popup can access it.
          chrome.storage.local.set({
            pendingContent: content,
            sourceTab: tab.id
          });
        }
      );
    } else {
      // For all other cases, automatically save the content.
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
    // Check if the URL is a YouTube URL.
    // This regex will match common YouTube URL patterns.
    if (/youtube\.com\/watch\?v=|youtu\.be\//i.test(info.srcUrl)) {
      content.type = "youtube_video";
      content.data = info.srcUrl;
    } else {
      // Not a YouTube URL; handle other media types.
      if (info.mediaType === "image") {
        content.type = "image";
        try {
          // Convert the image URL to a data URI.
          content.data = await imageUrlToDataUri(info.srcUrl);
        } catch (error) {
          console.error("Error converting image to data URI:", error);
          // Optionally, fallback to sending the URL if conversion fails.
          content.data = info.srcUrl;
        }
      } else if (info.mediaType === "audio") {
        content.type = "audio";
        content.data = info.srcUrl;
      }
    }
  } else if (info.pageUrl) {
    content.type = "webpage";
    // Inject a content script to retrieve page content.
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

async function imageUrlToDataUri(url) {
  // Fetch the image as a Blob
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const blob = await response.blob();

  // Convert the Blob to a data URI using FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
