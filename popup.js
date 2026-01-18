
document.addEventListener('DOMContentLoaded', () => {
  const selectAreaBtn = document.getElementById('select-area');
  const extractClipboardBtn = document.getElementById('extract-clipboard');
  const statusContainer = document.getElementById('status-container');
  const statusText = document.getElementById('status-text');
  const resultContainer = document.getElementById('result-container');
  const outputText = document.getElementById('output-text');
  const copyTextBtn = document.getElementById('copy-text');
  const toast = document.getElementById('toast');

  // Show status
  function showStatus(msg) {
    statusText.innerText = msg;
    statusContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
  }

  function hideStatus() {
    statusContainer.classList.add('hidden');
  }

  function showResult(text) {
    hideStatus();
    if (text && text.trim()) {
      outputText.value = text;
      resultContainer.classList.remove('hidden');
    } else {
      showStatus("No text found.");
      setTimeout(hideStatus, 2000);
    }
  }

  // Show toast message
  function showToast(msg) {
    toast.innerText = msg;
    toast.classList.add('show');
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2000);
  }

  // Handle Select Area (Capture Visible Tab)
  selectAreaBtn.addEventListener('click', async () => {
    try {
      showStatus("Initializing selection...");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        showStatus("No active tab found.");
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showStatus("Cannot crop on system pages.");
        return;
      }

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Send start message
      chrome.tabs.sendMessage(tab.id, { action: 'START_SELECTION' });

      window.close();

    } catch (err) {
      console.error("Selection init error:", err);
      showStatus("Error: " + err.message);
    }
  });

  // Handle Clipboard Extraction
  extractClipboardBtn.addEventListener('click', async () => {
    try {
      showStatus("Reading clipboard...");
      const items = await navigator.clipboard.read();
      let imageBlob = null;

      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            imageBlob = await item.getType(type);
            break;
          }
        }
        if (imageBlob) break;
      }

      if (imageBlob) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Image = reader.result;

          showStatus("Processing...");

          // Send to background and WAIT for response
          chrome.runtime.sendMessage({
            action: 'OCR_DIRECT', // Different action for popup return
            imageData: base64Image
          }, (response) => {
            if (chrome.runtime.lastError) {
              showStatus("Error: " + chrome.runtime.lastError.message);
            } else if (response && response.success) {
              showResult(response.text);
            } else {
              showStatus("Error: " + (response.error || "Failed to extract"));
            }
          });

        };
        reader.readAsDataURL(imageBlob);

      } else {
        showStatus("No image found in clipboard.");
        setTimeout(hideStatus, 2000);
      }
    } catch (err) {
      console.error("Clipboard error:", err);
      showStatus("Error: " + err.message);
    }
  });

  // Handle Copy Text
  copyTextBtn.addEventListener('click', () => {
    const text = outputText.value;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast("Text copied successfully!");
      }).catch(err => {
        console.error("Copy failed:", err);
        showToast("Failed to copy text");
      });
    }
  });

  // Proactive Clipboard Check
  async function checkClipboard() {
    try {
      if (!navigator.clipboard) return;
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.some(type => type.startsWith('image/'))) {
          extractClipboardBtn.classList.add('pulse');
          break;
        }
      }
    } catch (e) {
      // Ignore permission errors etc
    }
  }

  checkClipboard();
});
