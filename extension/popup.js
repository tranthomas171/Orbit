document.getElementById('dashboard').addEventListener('click', async () => {
    let token = await chrome.storage.local.get('access_token');
    if(token) {
      token = "?t="+token
    } else {
      token = ""
    }
    chrome.tabs.create({ url: 'http://localhost:5173' + token }); // Change this to your dashboard URL
  });