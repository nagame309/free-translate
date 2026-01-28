
const BING_URL = 'https://www.bing.com';
const TRANSLATOR_URL = 'https://www.bing.com/translator';
const API_URL = 'https://www.bing.com/ttranslatev3?isVertical=1';

// Bing limits are strict for the free/web endpoint
const MAX_TEXT_LEN = 1000;

let cachedTokens = null;
let tokenTimestamp = 0;
const TOKEN_TTL = 1000 * 60 * 10; // 10 minutes cache

async function getBingTokens() {
  if (cachedTokens && (Date.now() - tokenTimestamp < TOKEN_TTL)) {
    return cachedTokens;
  }

  try {
    const response = await fetch(TRANSLATOR_URL);
    const html = await response.text();

    const igMatch = html.match(/IG:"([^"]+)"/);
    if (!igMatch) {
      throw new Error('無法從 Bing 取得 IG Token');
    }

    let iid = 'translator.5028'; 
    const iidMatch = html.match(/data-iid="([^"]+)"/);
    if (iidMatch) {
      iid = iidMatch[1];
    }

    let key = null;
    let token = null;

    const helperMatch = html.match(/var params_AbusePreventionHelper\s*=\s*(\[[^\]]+\])/);
    if (helperMatch) {
      try {
        const data = JSON.parse(helperMatch[1]);
        key = data[0];
        token = data[1];
      } catch (e) {
        console.warn('Failed to parse AbusePreventionHelper:', e);
      }
    } else {
      const fallbackMatch = html.match(/\[(\d{12,14}),"([a-zA-Z0-9]{30,})",\d+\]/);
      if (fallbackMatch) {
        key = fallbackMatch[1];
        token = fallbackMatch[2];
      }
    }

    cachedTokens = {
      IG: igMatch[1],
      IID: iid,
      key,
      token
    };
    tokenTimestamp = Date.now();
    
    return cachedTokens;
  } catch (error) {
    console.error('Bing Token Fetch Error:', error);
    throw error;
  }
}

/**
 * Splits long text into chunks that respect sentence boundaries and max length
 */
function splitTextIntoChunks(text, maxLength) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let currentChunk = '';
  
  // Split by common sentence delimiters to avoid breaking sentences
  // Priority: Newline > Period/Question/Exclamation > Comma > Space
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];

  for (const sentence of sentences) {
    // If a single sentence is too long, we have to hard split it
    if (sentence.length > maxLength) {
        if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        // Hard split long sentence
        let temp = sentence;
        while (temp.length > 0) {
            chunks.push(temp.slice(0, maxLength));
            temp = temp.slice(maxLength);
        }
    } else if (currentChunk.length + sentence.length > maxLength) {
        chunks.push(currentChunk);
        currentChunk = sentence;
    } else {
        currentChunk += sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Core function to make a single API request
 */
async function callBingApi(text, sourceLang, targetLang, tokens) {
    // Bing uses different language codes for some languages
    const langMap = {
      'zh-TW': 'zh-Hant',
      'zh-CN': 'zh-Hans',
      'auto': 'auto-detect'
    };
    
    const apiTargetLang = langMap[targetLang] || targetLang;
    const apiSourceLang = langMap[sourceLang] || sourceLang;
    
    const requestUrl = `${API_URL}&IG=${tokens.IG}&IID=${tokens.IID}`;
    
    const body = new URLSearchParams();
    body.append('fromLang', apiSourceLang);
    body.append('text', text);
    body.append('to', apiTargetLang);
    
    if (tokens.key && tokens.token) {
        body.append('token', tokens.token);
        body.append('key', tokens.key);
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: body
    });

    const data = await response.json();

    if (!response.ok) {
       if (data && data.error) throw new Error(`Bing API Error: ${data.error}`);
       if (data && data.statusCode) throw new Error(`Bing Error: ${data.statusCode} ${data.errorMessage || ''}`);
       throw new Error(`Bing API Error: ${response.status}`);
    }
    
    if (Array.isArray(data) && data.length > 0 && data[0].translations && data[0].translations.length > 0) {
      return {
        text: data[0].translations[0].text,
        detectedLang: data[0].detectedLanguage ? data[0].detectedLanguage.language : null
      };
    } else {
      if (data && data.statusCode) throw new Error(`Bing Error: ${data.statusCode}`);
      throw new Error('Bing 回傳格式不符');
    }
}

export async function translateWithBing(text, sourceLang, targetLang) {
  try {
    const tokens = await getBingTokens();
    
    // Split text if it's too long
    const chunks = splitTextIntoChunks(text, MAX_TEXT_LEN);
    
    // Process chunks sequentially to be polite to the API and avoid rate limits
    // Parallel might be faster but riskier for free/web endpoints
    const results = [];
    let detectedSourceLang = sourceLang;

    for (const chunk of chunks) {
        // Small delay between requests to avoid burst detection
        if (results.length > 0) await new Promise(r => setTimeout(r, 300));
        
        const result = await callBingApi(chunk, sourceLang, targetLang, tokens);
        results.push(result.text);
        
        // Capture detected language from the first chunk
        if (!detectedSourceLang || detectedSourceLang === 'auto') {
            detectedSourceLang = result.detectedLang;
        }
    }

    return {
      translation: results.join(''), // Join without separator as we split keeping delimiters
      sourceLang: detectedSourceLang || sourceLang
    };

  } catch (error) {
    console.error('Bing Translation Error:', error);
    if (error.message.includes('無法從 Bing 取得')) {
        throw new Error('Bing 服務連線失敗，請稍後再試');
    }
    throw error;
  }
}
