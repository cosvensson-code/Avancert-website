const jwt = require('jsonwebtoken');
const https = require('https');

function getToken(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/avancert_session=([^;]+)/);
  return m ? m[1] : null;
}

function githubRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Avancert-Editor',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Ikke logget ind' });

  let user;
  try { user = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Session udløbet' }); }

  const { filename, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'Mangler filnavn eller billeddata' });

  // Sanitize filename, add timestamp to avoid conflicts
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
  const ext = safe.includes('.') ? safe.split('.').pop() : 'jpg';
  const base = safe.replace(new RegExp('\\.' + ext + '$'), '');
  const finalName = `${base}-${Date.now()}.${ext}`;
  const filePath = `images/${finalName}`;

  const repo    = process.env.GITHUB_REPO;
  const branch  = process.env.GITHUB_BRANCH || 'main';
  const ghToken = process.env.GITHUB_TOKEN;

  const put = await githubRequest('PUT', `/repos/${repo}/contents/${filePath}`, {
    message: `Billede upload: ${finalName} (${user.name})`,
    content: data,
    branch
  }, ghToken);

  if (put.status !== 201)
    return res.status(500).json({ error: 'Upload til GitHub fejlede', details: put.data });

  return res.status(200).json({ ok: true, path: filePath });
};
