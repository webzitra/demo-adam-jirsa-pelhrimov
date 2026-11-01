// Spouští původní Netlify Functions (v1: handler(event) → { statusCode, headers, body })
// jako Vercel Node funkce. Logika backendu zůstává v netlify/functions beze změny.
async function readBody(req) {
  // Vercel Node runtime tělo načte sám a nabízí ho jako req.body (při neplatném JSON getter hází)
  let parsed;
  try {
    parsed = req.body;
  } catch {
    return '';
  }
  if (parsed !== undefined) {
    if (Buffer.isBuffer(parsed)) return parsed.toString('utf8');
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = function netlifyToVercel(handler) {
  return async function (req, res) {
    const url = new URL(req.url, 'http://localhost');
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
    }

    const event = {
      httpMethod: req.method,
      path: url.pathname,
      rawUrl: url.toString(),
      headers,
      queryStringParameters: Object.fromEntries(url.searchParams),
      // prázdný řetězec místo null: JSON.parse('') v handleru skončí jeho vlastní 400 „Invalid JSON“
      body: await readBody(req),
      isBase64Encoded: false,
    };

    let result;
    try {
      result = (await handler(event, {})) || {};
    } catch (err) {
      console.error('Function error:', err);
      result = { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Internal error' }) };
    }

    res.statusCode = result.statusCode || 200;
    for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
    for (const [key, values] of Object.entries(result.multiValueHeaders || {})) res.setHeader(key, values);
    const body = result.body == null ? '' : result.body;
    res.end(result.isBase64Encoded ? Buffer.from(body, 'base64') : body);
  };
};
