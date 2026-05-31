// api/lichess-token.js
// LICHESS_TOKEN 환경변수를 클라이언트에 안전하게 전달

async function apiHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.LICHESS_TOKEN || '';
  if (!token) {
    return res.status(404).json({ token: null });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ token });
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