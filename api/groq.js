// api/groq.js
async function apiHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY가 설정되지 않았습니다.' });

  console.log(`[Groq] Calling API with key: ${apiKey.slice(0, 7)}...${apiKey.slice(-3)}`);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'ChessEdu/1.0'
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[Groq] Error Response:', data);
      const errorMsg = data.error?.message || data.message || JSON.stringify(data);
      return res.status(response.status).json({ 
        error: `Groq 오류 (${response.status}): ${errorMsg}` 
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Groq] Exception:', error);
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