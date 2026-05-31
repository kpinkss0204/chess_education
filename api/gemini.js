// api/gemini.js
async function apiHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });

  console.log(`[Gemini] Calling API with key: ${apiKey.slice(0, 7)}...${apiKey.slice(-3)}`);

  try {
    const { model, messages, prompt, max_tokens, temperature } = req.body;
    const geminiModel = model || 'gemini-2.5-flash-lite';
    // Use v1beta for better model compatibility
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    let contents = [];
    let systemInstruction = null;

    if (Array.isArray(messages)) {
      messages.forEach(m => {
        if (m.role === 'system') {
          systemInstruction = { parts: [{ text: m.content }] };
        } else {
          contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          });
        }
      });
    } else if (prompt) {
      contents = [{ role: 'user', parts: [{ text: prompt }] }];
    } else {
      contents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
    }

    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 1000,
        temperature: temperature || 0.3
      }
    };

    if (systemInstruction) {
      requestBody.system_instruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[Gemini] FULL ERROR:', JSON.stringify(data));
      const errorMsg = data.error?.message || JSON.stringify(data);
      return res.status(response.status).json({ 
        error: `Gemini가 거절함 (${response.status}): ${errorMsg}` 
      });
    }
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ choices: [{ message: { content } }] });
  } catch (error) {
    console.error('[Gemini] Exception:', error);
    return res.status(500).json({ error: error.message });
  }
}

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,ANY',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  let body = {};
  try { if (event.body) body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; } catch (e) {}
  
  const req = { method: event.httpMethod, body, headers: event.headers || {}, query: event.queryStringParameters || {} };
  let responseObj = { status: 200, body: '', headers: {} };
  
  const res = {
    status: (code) => { responseObj.status = code; return res; },
    setHeader: (key, val) => { responseObj.headers[key] = val; return res; },
    json: (data) => { responseObj.body = JSON.stringify(data); responseObj.headers['Content-Type'] = 'application/json'; return res; },
    send: (data) => { responseObj.body = data; return res; },
    end: () => { return res; }
  };

  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error('[Fatal Error]:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Lambda Crash', message: err.message })
    };
  }

  return {
    statusCode: responseObj.status,
    body: responseObj.body,
    headers: { ...responseObj.headers, ...corsHeaders }
  };
};