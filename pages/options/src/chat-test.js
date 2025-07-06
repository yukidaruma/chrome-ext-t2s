import './index.css';
import './Options.css';

/* eslint-disable no-undef */

// Load the content script in test page in options
// eslint-disable-next-line import-x/no-unresolved
import('/content/all.iife.js');

const MAX_MESSAGE_COUNT = 20;

let messageCounter = 0;
/** @type {number | null} Timer ID for automatic message posting */
let autoPostTimer = null;

// Simulated user messages
const randomMessages = [
  'Hello',
  'Hi',
  'Well played',
  'こんにちは',
  'ありがとう',
  'おつかれさまでした',
  'ナイス！',
  '😄',
];
const randomNames = ['Donut', 'Choco', 'タルト', 'クレープ'];

function addMessage({ name, body, isAuto = false }) {
  if (!name || !body.trim()) {
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
    `<yt-live-chat-author-chip id="author-name">${name}</yt-live-chat-author-chip>` +
    `<yt-formatted-string id="message">${body}</yt-formatted-string>`;

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

  console.log('Message added:', name, body);
}

function addManualMessage() {
  const name = document.getElementById('input-name').value;
  const body = document.getElementById('input-body').value;

  if (!body.trim()) {
    return;
  }

  addMessage({ name, body, isAuto: false });
}

function addRandomMessage() {
  const name = randomNames[Math.floor(Math.random() * randomNames.length)];
  const body = randomMessages[Math.floor(Math.random() * randomMessages.length)];
  addMessage({ name, body, isAuto: true });
}

function clearMessages() {
  document.getElementById('items').innerHTML = '';
  messageCounter = 0;
}

function isAutoMode() {
  return location.hash === '#auto';
}

function updateModeDisplay() {
  const isAuto = isAutoMode();
  document.body.setAttribute('data-auto-mode', isAuto.toString());

  if (isAuto) {
    startAutoMode();
  } else {
    stopAutoMode();
  }
}

function startAutoMode() {
  document.getElementById('select-interval').disabled = false;

  const intervalMs = parseInt(document.getElementById('select-interval').value);
  autoPostTimer = setInterval(() => {
    addRandomMessage();
  }, intervalMs);
}

function stopAutoMode() {
  document.getElementById('select-interval').disabled = true;

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
  history.replaceState(null, '', location.pathname + (toAuto ? '#auto' : ''));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
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
    const messageInput = document.getElementById('input-body');
    if (messageInput) {
      messageInput.focus();
    }
  }
});

window.addEventListener('DOMContentLoaded', function () {
  addMessage({ name: 'System', body: 'Chat test page loaded', isAuto: true });
  addMessage({ name: randomNames.at(-1), body: 'こんにちは', isAuto: true });
});

window.addEventListener('load', function () {
  const messageInput = document.getElementById('input-body');
  if (messageInput) {
    messageInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        addManualMessage();
      }
    });
  }

  // Initialize on page load
  updateModeDisplay();

  // Add button event listeners
  document.getElementById('btn-add-message').addEventListener('click', addManualMessage);
  document.getElementById('btn-add-random-message').addEventListener('click', addRandomMessage);
  document.getElementById('btn-clear-logs').addEventListener('click', clearMessages);

  // Add mode toggle listeners
  document.querySelectorAll('.mode-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const newMode = toggle.dataset.newMode;
      toggleMode(newMode === 'auto');
    });
  });

  // Add interval change listener
  document.getElementById('select-interval').addEventListener('change', updateInterval);
});

if (!navigator.webdriver) {
  chrome.storage.sync.get('theme-storage-key', function (data) {
    const theme = data['theme-storage-key']?.theme ?? 'light';
    document.body.classList.add(theme);
  });
}

// Expose addMessage function globally for testing
Object.assign(window, { addMessage });
