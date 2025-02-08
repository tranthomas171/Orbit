let tags = [];
const tagInput = document.getElementById('tags');
const tagList = document.getElementById('tagList');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Notification elements
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

// Show notification function
function showNotification(message, type = 'success') {
  notificationMessage.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'flex';

  // Set up auto-close timer
  const timer = setTimeout(() => {
    hideNotification();
  }, 3000);

  // Handle manual close
  notificationClose.onclick = () => {
    clearTimeout(timer);
    hideNotification();
  };
}

// Hide notification function
function hideNotification() {
  notification.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    notification.style.display = 'none';
    notification.style.animation = 'slideIn 0.3s ease-out';
  }, 300);
}

// Handle tag input
tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const newTags = tagInput.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag && !tags.includes(tag));
    
    tags.push(...newTags);
    tagInput.value = '';
    renderTags();
  }
});

// Render tags
function renderTags() {
  tagList.innerHTML = '';
  tags.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    tagElement.innerHTML = `
      ${tag}
      <button onclick="removeTag('${tag}')">&times;</button>
    `;
    tagList.appendChild(tagElement);
  });
}

// Remove tag
function removeTag(tag) {
  tags = tags.filter(t => t !== tag);
  renderTags();
}

// Save content with tags
saveBtn.addEventListener('click', async () => {
  try {
    // Disable save button to prevent double-clicks
    saveBtn.disabled = true;
    
    const { pendingContent, access_token } = await chrome.storage.local.get([
      'pendingContent',
      'access_token'
    ]);

    if (!pendingContent || !access_token) {
      throw new Error('Missing content or authentication');
    }

    const response = await fetch('http://localhost:3030/api/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({
        content: pendingContent,
        tags
      })
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.statusText}`);
    }

    // Clear temporary storage
    await chrome.storage.local.remove(['pendingContent', 'sourceTab']);
    
    // Show success notification
    showNotification('Content saved successfully!', 'success');
    
    // Close popup after a brief delay to show notification
    setTimeout(() => {
      window.close();
    }, 1000);

  } catch (error) {
    console.error('Save error:', error);
    showNotification('Failed to save content', 'error');
    saveBtn.disabled = false;
  }
});

// Cancel and close popup
cancelBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['pendingContent', 'sourceTab']);
  window.close();
});