window.FreeTrans = window.FreeTrans || {};

window.FreeTrans.Tooltip = class TranslationTooltip {
  constructor() {
    this.element = null;
    this.scrollCheckInterval = null;
    this.lastScrollY = 0;
    this.lastScrollX = 0;
    
    // Default language
    this.currentLang = 'zh-TW';
    
    this.translations = {
      'zh-TW': {
        loading: '翻譯中...',
        error: '錯誤',
        copied: '已複製 ✓'
      },
      'en': {
        loading: 'Translating...',
        error: 'Error',
        copied: 'Copied ✓'
      }
    };
  }

  setLanguage(lang) {
    this.currentLang = lang || 'zh-TW';
  }

  getText(key) {
    const t = this.translations[this.currentLang] || this.translations['zh-TW'];
    return t[key] || key;
  }

  showLoading(rect, textLength) {
    const loadingText = this.getText('loading');
    const content = `<div class="translation-loading"><div class="translation-loading-spinner"></div><span>${loadingText}</span></div>`;
    this.create(content, rect);
  }

  showResult(content, rect) {
    this.updateContent(content, rect);
  }

  showError(message, rect) {
    const errorTitle = this.getText('error');
    // If message is technical, maybe keep it, or try to translate common errors if needed
    // For now we assume message comes from background and might be in English or specific error code
    const content = `<div class="translation-error"><strong>${errorTitle}:</strong> ${message}</div>`;
    this.updateContent(content, rect);
  }

  create(innerHtml, rect) {
    this.hide(); // Remove existing

    this.element = document.createElement('div');
    this.element.className = 'translation-tooltip';
    this.element.innerHTML = `<div class="translation-text">${innerHtml}</div>`;

    // Initial style for calculation
    Object.assign(this.element.style, {
      visibility: 'hidden',
      opacity: '1',
      transform: 'none',
      position: 'fixed'
    });

    document.body.appendChild(this.element);
    this.setPosition(rect);
    
    // Make visible after positioning
    this.element.style.visibility = 'visible';
    
    // Bind copy event
    const contentElement = this.element.querySelector('.translation-content') || this.element.querySelector('.translation-text');
    if (contentElement) {
      contentElement.addEventListener('click', () => this.copyToClipboard(contentElement.textContent.trim()));
    }

    // Start scroll monitoring
    this.lastScrollY = window.scrollY;
    this.lastScrollX = window.scrollX;
    this.startScrollMonitoring();

    // Show animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.element) this.element.classList.add('show');
      });
    });
  }

  updateContent(innerHtml, rect) {
    if (!this.element) {
      this.create(innerHtml, rect);
      return;
    }

    const textElement = this.element.querySelector('.translation-text');
    if (textElement) textElement.innerHTML = innerHtml;

    // Re-bind copy event if content changed
    const contentElement = this.element.querySelector('.translation-content') || this.element.querySelector('.translation-text');
    if (contentElement) {
      // Remove old listeners ideally, but simpler to just add new one since we replaced innerHTML
      contentElement.onclick = () => this.copyToClipboard(contentElement.textContent.trim());
    }

    // Reset for recalculation
    Object.assign(this.element.style, {
      visibility: 'hidden',
      opacity: '1',
      transform: 'none'
    });

    this.setPosition(rect);

    // Show
    Object.assign(this.element.style, {
      visibility: 'visible',
      opacity: '',
      transform: ''
    });
    
    // Re-trigger animation class
    this.element.classList.remove('show');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.element) this.element.classList.add('show');
      });
    });
  }

  setPosition(rect) {
    if (!this.element) return;

    const tooltipRect = this.element.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height;
    const tooltipWidth = tooltipRect.width;
    const viewportHeight = window.innerHeight;
    
    // Logic to determine position (Above or Below)
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

    // Logic for X position
    let x = rect.right - tooltipWidth;
    if (x < 10) x = rect.left;
    x = Math.max(10, Math.min(x, window.innerWidth - tooltipWidth - 10));

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    
    // Arrow positioning
    this.element.className = `translation-tooltip ${arrowClass}`; // Reset class
    
    const arrowTargetX = rect.right;
    const arrowRightPosition = x + tooltipWidth - arrowTargetX;
    const clampedArrowRight = Math.max(10, Math.min(tooltipWidth - 10, arrowRightPosition));
    
    this.element.style.setProperty('--arrow-right-position', `${clampedArrowRight}px`);
  }

  hide() {
    if (this.element) {
      this.element.classList.remove('show');
      const el = this.element;
      setTimeout(() => el.remove(), 250); // Remove after animation
      this.element = null;
    }
    this.stopScrollMonitoring();
  }

  startScrollMonitoring() {
    this.stopScrollMonitoring();
    this.scrollCheckInterval = setInterval(() => {
      if (this.element) {
        if (window.scrollY !== this.lastScrollY || window.scrollX !== this.lastScrollX) {
          this.hide();
        }
      } else {
        this.stopScrollMonitoring();
      }
    }, 100);
  }

  stopScrollMonitoring() {
    if (this.scrollCheckInterval) {
      clearInterval(this.scrollCheckInterval);
      this.scrollCheckInterval = null;
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showCopyFeedback();
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback');
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showCopyFeedback();
      } catch (e) {}
      textarea.remove();
    }
  }

  showCopyFeedback() {
    if (!this.element) return;
    const contentEl = this.element.querySelector('.translation-content') || this.element.querySelector('.translation-text');
    if (!contentEl) return;

    const feedbackText = this.getText('copied');

    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = feedbackText;
    contentEl.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1200);
  }
}