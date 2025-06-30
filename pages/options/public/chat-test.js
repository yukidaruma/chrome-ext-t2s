/* eslint-disable no-undef */

// Load the content script in test page in options
// eslint-disable-next-line import-x/no-unresolved
if (!navigator.webdriver) import('/content/all.iife.js');

const MAX_MESSAGE_COUNT = 20;

let messageCounter = 0;
/** @type {number | null} Timer ID for automatic message posting */
let autoPostTimer = null;

// Simulated user messages
const randomMessages = ['Hello', 'Hi', 'Well played', 'こんにちは', 'ありがとう', 'おつかれさまでした', 'ナイス！'];
const randomAuthors = ['Donut', 'Choco', 'タルト', 'クレープ'];

function addMessage({ author, message, isAuto = false }) {
  if (!author || !message.trim()) {
    return;
  }

  messageCounter++;

  // Mimic YouTube live chat structure
  const messageElement = document.createElement('yt-live-chat-text-message-renderer');
  messageElement.setAttribute('id', messageCounter);
  if (isAuto) {
    messageElement.classList.add('auto-message');
  }
  messageElement.innerHTML =
    `<yt-live-chat-author-chip id="author-name" style="font-weight: bold; color: #1976d2;">${author}</yt-live-chat-author-chip>` +
    `<yt-formatted-string id="message">${message}</yt-formatted-string>`;

  // Add new message to bottom
  const container = document.getElementById('items');
  container.appendChild(messageElement);

  // Remove old messages if count exceeds limit
  const messages = container.querySelectorAll('yt-live-chat-text-message-renderer');
  if (messages.length > MAX_MESSAGE_COUNT) {
    const deleteCount = messages.length - MAX_MESSAGE_COUNT;
    for (let i = 0; i < deleteCount; i++) {
      messages[i].remove();
    }
  }

  // Auto scroll
  container.scrollTop = container.scrollHeight;

  console.log('Message added:', author, message);
}

function addManualMessage() {
  const authorName = document.getElementById('input-author').value;
  const messageText = document.getElementById('input-message').value;

  if (!messageText.trim()) {
    return;
  }

  addMessage({ author: authorName, message: messageText, isAuto: false });
}

function addRandomMessage() {
  const randomAuthor = randomAuthors[Math.floor(Math.random() * randomAuthors.length)];
  const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
  addMessage({ author: randomAuthor, message: randomMessage, isAuto: true });
}

function clearMessages() {
  document.getElementById('items').innerHTML = '';
  messageCounter = 0;
}

function isAutoMode() {
  return location.hash === '#auto';
}

function updateModeDisplay() {
  isAuto = isAutoMode();
  document.body.setAttribute('data-auto-mode', isAuto.toString());

  if (isAuto) {
    startAutoMode();
  } else {
    stopAutoMode();
  }
}

function startAutoMode() {
  const intervalMs = parseInt(document.getElementById('select-interval').value);
  autoPostTimer = setInterval(() => {
    addRandomMessage();
  }, intervalMs);
}

function stopAutoMode() {
  if (autoPostTimer) {
    clearInterval(autoPostTimer);
    autoPostTimer = null;
  }
}

function updateInterval() {
  if (autoPostTimer) {
    clearInterval(autoPostTimer);
  }
  startAutoMode();
}

function toggleMode(toAuto) {
  location.hash = toAuto ? '#auto' : '';
}

// Listen for hash changes
window.addEventListener('hashchange', updateModeDisplay);

// Global keyboard shortcuts
document.addEventListener('keydown', function (e) {
  if (e.altKey) {
    e.preventDefault();
    switch (e.key) {
      case 'a':
        addRandomMessage();
        break;
      case 'm':
        toggleMode(!isAutoMode());
        break;
      case 'c':
        clearMessages();
        break;
    }
  }
});

// Auto-focus input on keypress when no element is focused
document.addEventListener('keypress', function () {
  const activeElement = document.activeElement;
  const isInputFocused =
    activeElement &&
    (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

  if (!isInputFocused) {
    const messageInput = document.getElementById('input-message');
    if (messageInput) {
      messageInput.focus();
    }
  }
});

// Enter key to send message (always available)
window.addEventListener('load', function () {
  const messageInput = document.getElementById('input-message');
  if (messageInput) {
    messageInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        addManualMessage();
      }
    });
  }
});

// window.contentloaded
window.addEventListener('DOMContentLoaded', function () {
  addMessage({ author: 'System', message: 'Chat test page loaded', isAuto: true });
  addMessage({ author: randomAuthors.at(-1), message: 'こんにちは', isAuto: true });
});

window.addEventListener('load', function () {
  // Initialize on page load
  updateModeDisplay();

  // Add button event listeners
  document.getElementById('btn-add-message').addEventListener('click', addManualMessage);
  document.getElementById('btn-add-random-message').addEventListener('click', addRandomMessage);
  document.getElementById('btn-clear-logs').addEventListener('click', clearMessages);

  // Add mode toggle listeners
  document.querySelectorAll('.mode-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const mode = toggle.dataset.mode;
      toggleMode(mode === 'auto');
    });
  });

  // Add interval change listener
  document.getElementById('select-interval').addEventListener('change', updateInterval);
});
