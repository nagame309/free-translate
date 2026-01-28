# 專案交接文件：浮譯 (FreeTrans)

## 1. 專案簡介
這是一個 Chrome 瀏覽器擴充功能，提供「劃詞翻譯」功能。
*   **核心功能**：滑鼠選取網頁文字後，顯示浮動視窗並提供翻譯結果。
*   **支援服務**：Google Translate, Bing Translator (含長文自動分段), OpenAI (及相容 API, 如 Ollama, DeepSeek)。
*   **設計風格**：採用 **Catppuccin** 配色方案 (Light/Dark 模式)，扁平化 GitHub 風格設定頁面。
*   **主要語言**：繁體中文 (zh-TW) / English (en)。

## 2. 目前工作進度

### UI/UX 改進
*   **配色**：全面套用 Catppuccin 色票。
    *   **淺色模式**：主背景 `#EFF1F5`, 輸入框/下拉 `#E6E9EF`, 文字 `#5D6075`, 強調色 (Mauve) `#8839ef`。
    *   **深色模式**：主背景 `#303446`, 輸入框/下拉 `#292C3C`, 文字 `#B8C0DF`, 強調色 (Mauve) `#ca9ee6`。
*   **Options 頁面**：
    *   重構為 GitHub 風格的扁平化設計。
    *   移除卡片式佈局，改用分隔線區分。
    *   **多語言支援**：實作了即時語言切換 (zh-TW/en)，且設定會自動儲存 (`chrome.storage.sync`)。
    *   **進階設定**：將 Temperature, User Prompt, System Prompt 收納至 `<details>` 摺疊區塊，並美化了展開按鈕。
*   **Popup 頁面**：
    *   統一配色與圓角風格。
    *   支援多語言切換。

### 功能實作
*   **OpenAI / Compatible Service**：
    *   新增 `Base URL`, `API Key`, `Model` 設定。
    *   新增 `Temperature`, `User Prompt`, `System Prompt` 進階設定。
    *   實作 **「測試連線」** 功能：可直接使用當前輸入框的值發送測試請求。
    *   User Prompt 支援 `{{to}}` 與 `{{text}}` 動態變數。
*   **Bing 翻譯**：
    *   實作長文自動分段 (Auto-chunking)，解決 1000 字元限制導致的 400 錯誤。
*   **錯誤處理**：
    *   優化錯誤訊息顯示（包含實際請求的 URL 以便除錯 404 問題）。

## 3. 當前遭遇問題 (The 403 Issue)

### 狀況描述
在詳細設定頁面測試連接遠端 Ollama 伺服器時，回傳 `API Error: 403`。

*   **測試環境**：
    *   Server IP: `100.127.215.11`
    *   Port: `11434`
    *   Model: `translategemma:4b`
    *   Extension 設定 Base URL: `http://100.127.215.11:11434/v1`

### 診斷結果
1.  **Node.js 測試腳本**：使用相同參數在本地執行腳本，**成功**獲得回應。證明網路、IP、Port 和 API 路徑皆正確。
2.  **Chrome Extension 測試**：**失敗 (403 Forbidden)**。

### 推測原因
**Ollama 的 CORS/Origin 安全限制**。
Chrome Extension 發送請求時會帶有 `Origin: chrome-extension://<extension-id>` 標頭。Ollama 預設可能拒絕了非 Localhost 或未白名單化的 Origin，因此回傳 403 禁止訪問。

## 4. 下一步工作建議 (Next Steps)

1.  **解決 403 問題 (優先)**：
    *   **方案 A (Server端)**：請使用者在 Ollama 伺服器啟動參數中加入環境變數 `OLLAMA_ORIGINS="*"` (或指定 `chrome-extension://*`)，以允許來自 Extension 的請求。
    *   **方案 B (Extension端 - 較難)**：嘗試修改 Background script 的 `fetch` 參數，看看能否移除或偽造 Origin 標頭（但在 Manifest V3 中通常被禁止）。
    *   **方案 C (Proxy)**：建議使用者使用 Nginx 或其他反向代理來處理 CORS headers。

2.  **其他待辦**：
    *   確認測試連線成功後的 UI 流程。
    *   檢查其他翻譯服務 (Google/Bing) 在新 UI 下的運作是否正常。
    *   最後的代碼清理 (移除 console log)。

## 5. 檔案結構摘要
*   `src/background/services/openai.js`: 核心 AI 翻譯邏輯 (已修復 Regex 語法錯誤)。
*   `options/options.js`: 設定頁面邏輯 (含 i18n, 自動儲存, 測試連線)。
*   `options/options.css`: 設定頁面樣式 (GitHub 風格, Catppuccin 主題)。
