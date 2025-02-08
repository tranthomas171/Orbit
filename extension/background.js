const DASHBOARD_URL = 'http://localhost:3000';
const API_ENDPOINT = 'http://localhost:5000/api';
let userToken = null;

// Check authentication status on startup
chrome.runtime.onStartup.addListener(checkAuth);
chrome.runtime.onInstalled.addListener(checkAuth);

async function checkAuth() {
  try {
    const token = await chrome.storage.local.get('authToken');
    if (!token.authToken) {
      // Redirect to login if no token found
      await initiateLogin();
    } else {
      userToken = token.authToken;
      // Verify token with backend
      const isValid = await verifyToken(userToken);
      if (!isValid) {
        await initiateLogin();
      }
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    await initiateLogin();
  }
}
async function initiateLogin() {
  try {
    console.log("Starting login process...");
    
    // Use getAuthToken instead of launchWebAuthFlow
    const auth = await chrome.identity.getAuthToken({ 
      interactive: true,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    });
    
    console.log("Got auth token:", auth ? "Yes" : "No");
    
    if (auth && auth.token) {
      console.log("Sending token to backend...");
      // Exchange Google token for your backend token
      const response = await fetch(`${API_ENDPOINT}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ google_token: auth.token })
      });
      
      console.log("Backend response status:", response.status);
      const responseText = await response.text();
      console.log("Backend response:", responseText);
      
      if (!response.ok) {
        console.error("Backend auth failed:", responseText);
        throw new Error('Backend auth failed');
      }
      
      const data = JSON.parse(responseText);
      userToken = data.token;
      await chrome.storage.local.set({ authToken: userToken });
      console.log("Successfully stored auth token");
    } else {
      throw new Error('Failed to get auth token');
    }
  } catch (error) {
    console.error('Login failed:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

async function verifyToken(token) {
  try {
    const response = await fetch(`${API_ENDPOINT}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Modify sendToBackend to include auth token
function sendToBackend(data) {
  if (!userToken) {
    initiateLogin().then(() => sendToBackend(data));
    return;
  }

  fetch(`${API_ENDPOINT}/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify(data)
  })
  .then(response => {
    if (response.status === 401) {
      // Token expired or invalid
      return initiateLogin().then(() => sendToBackend(data));
    }
    return response.json();
  })
  .then(result => {
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  })
  .catch(error => {
    console.error('Error:', error);
    chrome.action.setBadgeText({ text: '❌' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
  });
}