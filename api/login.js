const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email og adgangskode er påkrævet' });

  let users;
  try {
    users = JSON.parse(process.env.USERS_JSON || '[]');
  } catch {
    return res.status(500).json({ error: 'Konfigurationsfejl' });
  }

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Forkert email eller adgangskode' });

  const token = jwt.sign(
    { email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `avancert_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`
  );
  return res.status(200).json({ name: user.name });
};
