module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body || {};
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email ikke konfigureret (mangler RESEND_API_KEY)' });

  const to = process.env.CONTACT_EMAIL || 'info@avancert.dk';

  let subject, text;

  if (b.formType === 'tilbud') {
    subject = `Tilbudsforespørgsel: ${b.company || b.name || '(ukendt)'}`;
    text = [
      'STANDARDER',
      `Ønskede standarder: ${b.standards || 'Ikke valgt'}`,
      '',
      'VIRKSOMHED',
      `Firmanavn: ${b.company || ''}`,
      `Antal medarbejdere: ${b.size || ''}`,
      `Allerede certificeret: ${b.certified || ''}`,
      '',
      'KONTAKT',
      `Navn: ${b.name || ''}`,
      `Telefon: ${b.phone || ''}`,
      `Email: ${b.email || ''}`,
    ].join('\n');
  } else {
    subject = `Henvendelse (${b.type || 'Klage'}): ${b.name || '(ukendt)'}`;
    text = [
      `Type: ${b.type || ''}`,
      `Navn: ${b.name || ''}`,
      `Email: ${b.email || ''}`,
      `Virksomhed: ${b.company || ''}`,
      '',
      'Beskrivelse:',
      b.message || '',
    ].join('\n');
  }

  // 'from' kræver en verificeret domæne i Resend.
  // Brug onboarding@resend.dev under test; skift til noreply@avancert.dk når domænet er verificeret.
  const from = process.env.RESEND_FROM || 'Avancert hjemmeside <onboarding@resend.dev>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(b.email ? { reply_to: [b.email] } : {}),
        subject,
        text,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Resend-fejl', details: data });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Netværksfejl mod Resend' });
  }
};
