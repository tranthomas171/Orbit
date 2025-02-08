// tagPopup.js
let tags = [];
const tagInput = document.getElementById('tagInput');
const tagContainer = document.getElementById('tagContainer');
const saveButton = document.getElementById('saveButton');
const cancelButton = document.getElementById('cancelButton');

// Handle tag input
tagInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    const value = tagInput.value.replace(',', '').trim();
    if (value && !tags.includes(value)) {
      addTag(value);
    }
    tagInput.value = '';
  }
});

// Add tag to UI
function addTag(tag) {
  tags.push(tag);
  const tagElement = document.createElement('span');
  tagElement.className = 'tag';
  tagElement.innerHTML = `${tag} <button onclick="removeTag('${tag}')">&times;</button>`;
  tagContainer.appendChild(tagElement);
}

// Remove tag
function removeTag(tag) {
  tags = tags.filter(t => t !== tag);
  renderTags();
}

// Render all tags
function renderTags() {
  tagContainer.innerHTML = '';
  tags.forEach(tag => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.innerHTML = `${tag} <button onclick="removeTag('${tag}')">&times;</button>`;
    tagContainer.appendChild(tagElement);
  });
}

// Handle save
saveButton.addEventListener('click', () => {
  chrome.storage.local.get(['pendingSave'], ({ pendingSave }) => {
    if (pendingSave) {
      const { data } = pendingSave;
      data.tags = tags;
      
      // Send to backend
      fetch('http://localhost:5000/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
      .then(() => {
        // Show success notification in the source tab
        chrome.action.setBadgeText({ text: '✓' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
        window.close();
      })
      .catch(error => {
        console.error('Error:', error);
        chrome.action.setBadgeText({ text: '❌' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
        window.close();
      });
    }
  });
});

// Handle cancel
cancelButton.addEventListener('click', () => {
  window.close();
});