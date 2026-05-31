// api/lichess-token.js
// Vercel Serverless Function
// LICHESS_TOKEN 환경변수를 클라이언트에 안전하게 전달

export function handler(req, res) {
  // GET 요청만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.LICHESS_TOKEN || '';

  if (!token) {
    return res.status(404).json({ token: null });
  }

  // 캐시 방지 (토큰 갱신 시 즉시 반영)
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ token });
}

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
    json: (data) => { responseObj.body = JSON.stringify(data); responseObj.headers['Content-Type'] = 'application/json'; return res; },
    setHeader: (key, val) => { responseObj.headers[key] = val; return res; },
    send: (data) => { responseObj.body = data; return res; },
    end: () => { return res; }
  };

  await handler(req, res);

  return {
    statusCode: responseObj.status,
    body: responseObj.body,
    headers: responseObj.headers,
  };
};
