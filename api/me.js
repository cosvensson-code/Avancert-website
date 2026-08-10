const jwt = require('jsonwebtoken');

function getToken(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/avancert_session=([^;]+)/);
  return m ? m[1] : null;
}

module.exports = async (req, res) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Ikke logget ind' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ name: payload.name, email: payload.email });
  } catch {
    return res.status(401).json({ error: 'Session udløbet' });
  }
};
