// api/explorer.js
// Vercel 프록시: 브라우저 대신 서버에서 Lichess API 호출
// 토큰이 클라이언트에 노출되지 않음

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
  const { db, ...rest } = req.query;

  if (!db || (db !== 'masters' && db !== 'lichess')) {
    return res.status(400).json({ error: 'db parameter must be masters or lichess' });
  }

  // 쿼리 파라미터 그대로 전달
  const params = new URLSearchParams(rest).toString();
  const lichessUrl = `https://explorer.lichess.ovh/${db}?${params}`;

  try {
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const lichessRes = await fetch(lichessUrl, { headers });

    res.setHeader('Cache-Control', 'public, s-maxage=60');
    res.setHeader('Content-Type', 'application/json');
    res.status(lichessRes.status);

    const data = await lichessRes.text();
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export { apiHandler as handler };

export const handler = async (event, context) => {
  const req = {
    method: event.httpMethod,
    body: JSON.parse(event.body || '{}'),
    headers: event.headers,
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