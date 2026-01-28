// Popup script for translation extension settings

document.addEventListener('DOMContentLoaded', function() {
  const sourceLangSelect = document.getElementById('source-lang');
  const targetLangSelect = document.getElementById('target-lang');
  const autoTranslateCheckbox = document.getElementById('auto-translate');
  const saveButton = document.getElementById('save-settings');

  // Load saved settings
  loadSettings();

  // Save settings when button is clicked
  saveButton.addEventListener('click', saveSettings);

  // Add arrow rotation on select open/close
  const selects = [sourceLangSelect, targetLangSelect];
  selects.forEach(select => {
    let isOpen = false;
    
    select.addEventListener('click', function(e) {
      // Toggle open state
      isOpen = !isOpen;
      if (isOpen) {
        this.classList.add('select-open');
      } else {
        this.classList.remove('select-open');
      }
    });
    
    select.addEventListener('blur', function() {
      // Reset when losing focus
      isOpen = false;
      this.classList.remove('select-open');
    });
  });

  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({
        sourceLang: 'auto',
        targetLang: 'zh-TW',
        autoTranslate: true
      }, function(items) {
        sourceLangSelect.value = items.sourceLang || 'auto';
        targetLangSelect.value = items.targetLang || 'zh-TW';
        autoTranslateCheckbox.checked = items.autoTranslate !== false;
      });
    } else {
      console.warn('Chrome storage not available, using defaults');
      sourceLangSelect.value = 'auto';
      targetLangSelect.value = 'zh-TW';
      autoTranslateCheckbox.checked = true;
    }
  }

  function saveSettings() {
    const settings = {
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value,
      autoTranslate: autoTranslateCheckbox.checked
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set(settings, function() {
        // Show success feedback
        showSaveFeedback('儲存成功 ✓');
      });
    } else {
      console.warn('Chrome storage not available, settings not saved');
      showSaveFeedback('儲存失敗 ✗', true);
    }
  }

  function showSaveFeedback(message, isError = false) {
    const feedback = document.createElement('div');
    feedback.className = 'save-feedback';
    feedback.textContent = message;
    if (isError) {
      feedback.style.background = 'rgba(244, 67, 54, 0.95)';
    }
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.remove();
    }, 1200);
  }
});