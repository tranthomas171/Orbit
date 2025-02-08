document.getElementById('dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' }); // Change this to your dashboard URL
  });