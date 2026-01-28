# GEMINI.md - Project Context

## Project Overview

**Project Name:** 浮譯 (FreeTrans)
**Type:** Chrome Browser Extension (Manifest V3)
**Purpose:** A lightweight, elegant "select-to-translate" extension. It displays a floating tooltip with translations when a user selects text on any webpage.
**Design Philosophy:** Minimalist, Glassmorphism UI, Catppuccin color scheme (Light/Dark support).

## Technical Architecture

### Core Components
*   **Manifest V3:** Uses `service_worker` for background tasks.
*   **Background Script (`src/background/main.js`):**
    *   Acts as the central controller.
    *   Handles message passing between content scripts and translation services.
    *   Manages translation logic (`src/background/services/`).
*   **Content Scripts (`src/content/`):**
    *   `index.js`: Main entry point. Listens for user selection events (`mouseup`) and scroll events.
    *   `tooltip.js`: Renders the floating translation UI (DOM manipulation, positioning, animation).
    *   `utils.js`: Helper functions (text filtering, language tag formatting).
*   **Popup (`popup.html`):** Quick access to basic settings (Source/Target language, toggle switch).
*   **Options (`options/options.html`):** detailed configuration, specifically for AI services (OpenAI/Compatible APIs), custom prompts, and connection testing.

### Translation Services (`src/background/services/`)
1.  **Google Translate:** Default, free API usage.
2.  **Bing Translator:** Supports auto-chunking for long texts to bypass character limits.
3.  **OpenAI (and compatible):**
    *   Supports custom Base URL (e.g., for Ollama, DeepSeek).
    *   Configurable System and User prompts.
    *   Temperature control.
    *   "Test Connection" feature implemented in Options page.

## Key Files

*   `manifest.json`: Extension configuration (permissions, host permissions, entry points).
*   `src/background/main.js`: Service worker entry point.
*   `src/content/tooltip.js`: Logic for creating and positioning the floating UI.
*   `options/options.js`: Logic for the settings page, including custom i18n, auto-saving, and the "Test Connection" feature.
*   `content.css` / `popup.css` / `options/options.css`: Styling files using CSS variables for theming.

## Development & Build

*   **Language:** Vanilla JavaScript (ES Modules), HTML, CSS.
*   **No Build Step Required for Dev:** The extension can be loaded directly as an unpacked extension in Chrome.
*   **Packaging:**
    *   `python build.py`: Creates a `.zip` file in the `dist/` directory for release.

## Current Status & Known Issues

*   **UI/UX:**
    *   Fully implemented Catppuccin theme (Latte/Frappe).
    *   Options page redesigned with a "GitHub-like" flat style.
    *   Multi-language UI (Traditional Chinese / English) implemented via custom JS logic.
*   **AI Integration:**
    *   Connection test feature is functional but may face CORS/Origin issues with some local/remote servers (e.g., Ollama).
    *   **Known Issue (403 Forbidden):** Testing connection to a remote Ollama server fails with 403, likely due to the server rejecting the `chrome-extension://` origin header. This requires server-side configuration (`OLLAMA_ORIGINS="*"`).

## Operational Conventions

*   **Storage:**
    *   `chrome.storage.local`: Used for sensitive data (API Keys) and AI configurations.
    *   `chrome.storage.sync`: Used for UI preferences (Theme, Language) to sync across devices.
*   **Styling:** Use CSS variables defined in `:root` for colors to support dynamic theming.
*   **Commits:** Follow standard git practices.
