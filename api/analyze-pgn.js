// api/analyze-pgn.js
// Render 백엔드 /analyze-pgn 프록시

async function apiHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const response = await fetch('https://chess-backend-r3bc.onrender.com/analyze-pgn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Backend returned non-JSON response', detail: text });
    }
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || data.detail || 'Backend API 오류' });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', detail: error.message });
  }
}

// AWS Lambda Handler
export const handler = async (event, context) => {
  let body = {};
  try {
    if (event.body) {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }
  } catch (e) {
    console.error('Body Parse Error:', e);
  }

  const req = {
    method: event.httpMethod,
    body: body,
    headers: event.headers || {},
    query: event.queryStringParameters || {},
  };
  
  let responseObj = { status: 200, body: '', headers: {} };
  const res = {
    status: (code) => { responseObj.status = code; return res; },
    setHeader: (key, val) => { responseObj.headers[key] = val; return res; },
    json: (data) => { 
      responseObj.body = JSON.stringify(data); 
      responseObj.headers['Content-Type'] = 'application/json'; 
      return res; 
    },
    send: (data) => { responseObj.body = data; return res; },
    end: () => { return res; }
  };

  try {
    await apiHandler(req, res);
  } catch (err) {
    console.error('Handler Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', detail: err.message }),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    };
  }

  return {
    statusCode: responseObj.status,
    body: responseObj.body,
    headers: {
      ...responseObj.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  };
};