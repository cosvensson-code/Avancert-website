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

  const { file, changes } = req.body || {};
  const allowed = ['index.html', 'tilbudsinfo.html'];
  if (!allowed.includes(file)) return res.status(400).json({ error: 'Ugyldig fil' });
  if (!changes || !Object.keys(changes).length) return res.status(400).json({ error: 'Ingen ændringer' });

  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const ghToken = process.env.GITHUB_TOKEN;

  // Fetch current file
  const get = await githubRequest('GET', `/repos/${repo}/contents/${file}?ref=${branch}`, null, ghToken);
  if (get.status !== 200) return res.status(500).json({ error: 'Kunne ikke hente filen fra GitHub' });

  const sha = get.data.sha;
  let html = Buffer.from(get.data.content, 'base64').toString('utf-8');

  // Apply each change: find data-key element and replace its text content
  for (const [key, newText] of Object.entries(changes)) {
    const ek = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Matches: opening tag with data-key → text content (no child tags) → closing tag
    const rx = new RegExp(`(<[^>]+data-key="${ek}"[^>]*>)([^<]*)(</[a-zA-Z0-9]+>)`, 'g');
    const safe = String(newText)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(rx, `$1${safe}$3`);
  }

  // Commit
  const ts = new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' });
  const put = await githubRequest('PUT', `/repos/${repo}/contents/${file}`, {
    message: `Redaktør: ${user.name} — ${ts}`,
    content: Buffer.from(html, 'utf-8').toString('base64'),
    sha,
    branch
  }, ghToken);

  if (put.status !== 200 && put.status !== 201)
    return res.status(500).json({ error: 'GitHub-fejl ved gemning', details: put.data });

  return res.status(200).json({ ok: true });
};
