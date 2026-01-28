// Content script for translation extension

class TranslationTooltip {
  constructor() {
    this.tooltip = null;
    this.selectedText = '';
    this.settings = {
      sourceLang: 'auto',
      targetLang: 'zh-TW',
      autoTranslate: true
    };
    this.translationTimeout = null;
    this.init();
  }

  init() {
    // Load settings when initialized
    this.loadSettings();

    // Add event listeners
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Hide tooltip when scrolling - use passive: false to ensure it works
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true, capture: true });
    document.addEventListener('scroll', this.handleScroll.bind(this), { passive: true, capture: true });
    
    // Also listen for wheel events (mouse wheel scrolling)
    window.addEventListener('wheel', this.handleScroll.bind(this), { passive: true });
    document.addEventListener('wheel', this.handleScroll.bind(this), { passive: true, capture: true });
    
    // Listen for settings changes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          this.loadSettings();
        }
      });
    }
  }

  async loadSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const result = await new Promise((resolve) => {
          chrome.storage.sync.get({
            sourceLang: 'auto',
            targetLang: 'zh-TW',
            autoTranslate: true
          }, resolve);
        });
        this.settings = result;
        console.log('Settings loaded:', this.settings);
      }
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
    }
  }

  handleMouseDown(e) {
    // Hide tooltip when clicking elsewhere
    if (this.tooltip && !this.tooltip.contains(e.target)) {
      this.hideTooltip();
    }
  }

  handleScroll(e) {
    // Hide tooltip when scrolling
    if (this.tooltip) {
      console.log('Scroll detected, hiding tooltip');
      this.hideTooltip();
    }
  }

  // Check if text is pure Chinese (no English/numbers/other languages)
  isPureChinese(text) {
    // Remove all whitespace and punctuation
    const cleaned = text.replace(/[\s\p{P}]/gu, '');
    
    if (cleaned.length === 0) return false;
    
    // Check if text contains Chinese characters
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;
    const chineseMatches = cleaned.match(chineseRegex);
    
    if (!chineseMatches) return false;
    
    // Calculate the ratio of Chinese characters
    const chineseRatio = chineseMatches.length / cleaned.length;
    
    // If more than 80% is Chinese and no English letters, consider it pure Chinese
    const hasEnglish = /[a-zA-Z]/.test(cleaned);
    
    return chineseRatio > 0.8 && !hasEnglish;
  }

  async handleMouseUp(e) {
    // Clear any existing timeout
    if (this.translationTimeout) {
      clearTimeout(this.translationTimeout);
    }

    // Add debounce delay
    this.translationTimeout = setTimeout(async () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      // Check if there's valid selected text (minimum 3 characters)
      if (selectedText && selectedText.length >= 3) {
        // Check if auto-translate is enabled
        if (!this.settings.autoTranslate) {
          console.log('Auto-translate is disabled');
          return;
        }

        // Skip if the selected text is pure Chinese (no mixed content)
        if (this.isPureChinese(selectedText)) {
          console.log('Skipping pure Chinese text:', selectedText);
          return;
        }

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Only show translation if text is different from last time
          if (selectedText !== this.selectedText) {
            this.selectedText = selectedText;
            console.log('Translating:', selectedText);
            await this.showTranslation(selectedText, rect);
          }
        } catch (error) {
          console.error('Error getting selection:', error);
        }
      }
    }, 150); // 150ms debounce delay
  }

  async showTranslation(text, rect) {
    try {
      console.log('Fetching translation for:', text);
      
      // Start translation request
      const translationPromise = this.translateText(text);
      
      // Show loading state with estimated size
      this.createTooltip('<div class="translation-loading"><div class="translation-loading-spinner"></div><span>翻譯中...</span></div>', rect, text.length);
      
      // Wait for translation
      const result = await translationPromise;
      console.log('Translation result:', result);
      
      // Format with language tag
      const langTag = this.getLanguageTag(result.sourceLang, this.settings.targetLang);
      const content = `<div class="translation-language-tag">${langTag}</div><div class="translation-content">${this.escapeHtml(result.translation)}</div>`;
      
      // Update with actual translation and recalculate position
      this.updateTooltipWithTranslation(content, rect);
    } catch (error) {
      console.error('Translation failed:', error);
      this.updateTooltipWithTranslation(`<div class="translation-error">${error.message}</div>`, rect);
    }
  }

  getLanguageTag(sourceLang, targetLang) {
    const langNames = {
      'en': 'EN',
      'ja': 'JP',
      'ko': 'KR',
      'fr': 'FR',
      'de': 'DE',
      'es': 'ES',
      'zh-TW': '繁中',
      'zh-CN': '簡中',
      'auto': '自動'
    };
    
    const source = langNames[sourceLang] || sourceLang.toUpperCase();
    const target = langNames[targetLang] || targetLang.toUpperCase();
    
    return `${source} → ${target}`;
  }

  updateTooltipWithTranslation(content, rect) {
    if (!this.tooltip) return;
    
    // Update content first
    const textElement = this.tooltip.querySelector('.translation-text');
    if (textElement) {
      // Check if content contains HTML tags (error state)
      if (content.includes('<div')) {
        textElement.innerHTML = content;
      } else {
        textElement.innerHTML = content;
      }
    }
    
    // Temporarily hide to recalculate position
    this.tooltip.style.visibility = 'hidden';
    this.tooltip.style.opacity = '1';
    this.tooltip.style.transform = 'none';
    
    // Recalculate dimensions with new content
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height;
    const tooltipWidth = tooltipRect.width;
    
    // Recalculate position
    const viewportHeight = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    
    let y, arrowClass;
    
    if (spaceAbove >= tooltipHeight + 20) {
      y = rect.top - tooltipHeight - 10;
      arrowClass = 'arrow-bottom';
    } else if (spaceBelow >= tooltipHeight + 20) {
      y = rect.bottom + 10;
      arrowClass = 'arrow-top';
    } else {
      y = Math.max(10, rect.top - tooltipHeight - 10);
      arrowClass = 'arrow-bottom';
    }
    
    let x = rect.right - tooltipWidth;
    if (x < 10) {
      x = rect.left;
    }
    x = Math.max(10, Math.min(x, window.innerWidth - tooltipWidth - 10));
    
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    
    // Update arrow class if changed
    this.tooltip.className = 'translation-tooltip ' + arrowClass;
    
    // Recalculate arrow position
    const arrowTargetX = rect.right;
    const tooltipLeft = x;
    const arrowRightPosition = tooltipLeft + tooltipWidth - arrowTargetX;
    const minArrowRight = 10;
    const maxArrowRight = tooltipWidth - 10;
    const clampedArrowRight = Math.max(minArrowRight, Math.min(maxArrowRight, arrowRightPosition));
    this.tooltip.style.setProperty('--arrow-right-position', `${clampedArrowRight}px`);
    
    // Reset styles and show with animation
    this.tooltip.style.visibility = 'visible';
    this.tooltip.style.opacity = '';
    this.tooltip.style.transform = '';
    
    // Re-trigger animation
    this.tooltip.classList.remove('show');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.tooltip) {
          this.tooltip.classList.add('show');
        }
      });
    });
  }

  async translateText(text) {
    try {
      // Using Google Translate API
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${this.settings.sourceLang}&tl=${this.settings.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      console.log('Fetching from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        // Extract detected source language if available
        const detectedLang = data[2] || this.settings.sourceLang;
        return {
          translation: data[0][0][0],
          sourceLang: detectedLang
        };
      } else {
        throw new Error('無效的回應格式');
      }
    } catch (error) {
      console.error('translateText error:', error);
      if (error.message.includes('Failed to fetch')) {
        throw new Error('網路連線失敗');
      } else if (error.message.includes('HTTP error')) {
        throw new Error('翻譯服務暫時無法使用');
      }
      throw error;
    }
  }

  createTooltip(translation, rect, isLoading = false) {
    this.hideTooltip(); // Remove existing tooltip

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'translation-tooltip';
    this.tooltip.innerHTML = `<div class="translation-text">${translation}</div>`;

    // Temporarily add to DOM to get dimensions
    // Set visibility hidden but opacity 1 to get correct dimensions
    this.tooltip.style.visibility = 'hidden';
    this.tooltip.style.opacity = '1';
    this.tooltip.style.transform = 'none';
    this.tooltip.style.position = 'fixed';
    document.body.appendChild(this.tooltip);

    const tooltipRect = this.tooltip.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height;
    const tooltipWidth = tooltipRect.width;

    // Calculate position - prefer above, fallback to below if not enough space
    const viewportHeight = window.innerHeight;
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    let y, arrowClass;

    // Add scroll offset for accurate positioning
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    // Check if there's enough space above (tooltip height + some margin)
    if (spaceAbove >= tooltipHeight + 20) {
      // Position above
      y = rect.top - tooltipHeight - 10;
      arrowClass = 'arrow-bottom';
    } else if (spaceBelow >= tooltipHeight + 20) {
      // Position below
      y = rect.bottom + 10;
      arrowClass = 'arrow-top';
    } else {
      // Not enough space both ways, position above anyway
      y = Math.max(10, rect.top - tooltipHeight - 10);
      arrowClass = 'arrow-bottom';
    }

    // Position at the right side of selection, aligned to the right edge
    // Keep within viewport bounds with 10px margin
    let x = rect.right - tooltipWidth;
    
    // If tooltip would go off the left edge, align to left of selection instead
    if (x < 10) {
      x = rect.left;
    }
    
    // Make sure it doesn't go off the right edge
    x = Math.max(10, Math.min(x, window.innerWidth - tooltipWidth - 10));

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    
    // Reset styles for animation
    this.tooltip.style.visibility = 'visible';
    this.tooltip.style.opacity = '';
    this.tooltip.style.transform = '';

    // Calculate arrow position to point at the right side of selection
    // Arrow should point to rect.right relative to tooltip's left position
    const arrowTargetX = rect.right; // Right edge of selection in viewport
    const tooltipLeft = x; // Left edge of tooltip
    const arrowRightPosition = tooltipLeft + tooltipWidth - arrowTargetX;
    
    // Clamp arrow position to stay within tooltip bounds (with some margin)
    const minArrowRight = 10; // Minimum distance from right edge
    const maxArrowRight = tooltipWidth - 10; // Maximum distance from right edge
    const clampedArrowRight = Math.max(minArrowRight, Math.min(maxArrowRight, arrowRightPosition));
    
    // Set CSS variable for arrow position
    this.tooltip.style.setProperty('--arrow-right-position', `${clampedArrowRight}px`);

    // Update arrow position
    this.tooltip.classList.add(arrowClass);

    // Trigger animation after a small delay to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.tooltip.classList.add('show');
      });
    });

    // Add click to copy functionality
    const contentElement = this.tooltip.querySelector('.translation-content') || this.tooltip.querySelector('.translation-text');
    if (contentElement) {
      contentElement.addEventListener('click', () => this.copyTranslation());
    }

    // Store initial scroll position
    this.lastScrollY = window.scrollY;
    this.lastScrollX = window.scrollX;
    
    // Start monitoring scroll position
    this.startScrollMonitoring();

    console.log('Tooltip created at:', { x, y });
  }

  updateTooltipContent(content) {
    // This method is no longer needed, using updateTooltipWithTranslation instead
  }

  startScrollMonitoring() {
    // Clear any existing interval
    if (this.scrollCheckInterval) {
      clearInterval(this.scrollCheckInterval);
    }
    
    // Check scroll position every 100ms
    this.scrollCheckInterval = setInterval(() => {
      if (this.tooltip) {
        const currentScrollY = window.scrollY;
        const currentScrollX = window.scrollX;
        
        // If scroll position changed, hide tooltip
        if (currentScrollY !== this.lastScrollY || currentScrollX !== this.lastScrollX) {
          console.log('Scroll position changed, hiding tooltip');
          this.hideTooltip();
        }
      } else {
        // Tooltip is gone, stop monitoring
        clearInterval(this.scrollCheckInterval);
        this.scrollCheckInterval = null;
      }
    }, 100);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  hideTooltip() {
    if (this.tooltip) {
      // Remove show class for fade out animation
      this.tooltip.classList.remove('show');
      
      // Wait for animation to complete before removing from DOM
      setTimeout(() => {
        if (this.tooltip) {
          this.tooltip.remove();
          this.tooltip = null;
          this.selectedText = '';
        }
      }, 250); // Match the CSS transition duration
      
      // Clear scroll monitoring interval
      if (this.scrollCheckInterval) {
        clearInterval(this.scrollCheckInterval);
        this.scrollCheckInterval = null;
      }
    }
  }

  async copyTranslation() {
    if (!this.tooltip) return;
    
    // Try to get the translation content div first
    let contentElement = this.tooltip.querySelector('.translation-content');
    
    // If no specific content element, fall back to translation-text
    if (!contentElement) {
      contentElement = this.tooltip.querySelector('.translation-text');
    }
    
    if (!contentElement) return;
    
    // Get text content
    const text = contentElement.textContent.trim();
    
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(text);
      
      // Show feedback
      this.showCopyFeedback();
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      this.fallbackCopy(text);
    }
  }

  showCopyFeedback() {
    if (!this.tooltip) return;
    
    // Find the translation content element
    const contentElement = this.tooltip.querySelector('.translation-content');
    if (!contentElement) return;
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = '已複製 ✓';
    
    // Append to content element (not tooltip)
    contentElement.appendChild(feedback);
    
    // Remove after animation completes (1.2s)
    setTimeout(() => {
      if (feedback && feedback.parentNode) {
        feedback.remove();
      }
    }, 1200);
  }

  fallbackCopy(text) {
    // Fallback method for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      this.showCopyFeedback();
    } catch (error) {
      console.error('Fallback copy failed:', error);
    }
    
    textarea.remove();
  }
}

// Initialize when DOM is ready
let translationTooltip = null;

function initializeExtension() {
  if (!translationTooltip) {
    console.log('Initializing Translation Extension');
    translationTooltip = new TranslationTooltip();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}
