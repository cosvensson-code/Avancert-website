const RESEND_API = 'https://api.resend.com/emails';
const MIN_MS = 4000; // afvis hvis siden er udfyldt på under 4 sekunder

function clean(s) {
  return String(s || '').trim().slice(0, 2000);
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

async function send(apiKey, from, payload) {
  const r = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error('Resend-fejl'), { details: data });
  return data;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const b = req.body || {};

  // Honeypot: skjult felt skal være tomt
  if (b._hp) return res.status(200).json({ ok: true }); // ser ud som succes for bots

  // Minimumstid
  const elapsed = Date.now() - Number(b._t || 0);
  if (elapsed < MIN_MS) return res.status(400).json({ error: 'For hurtigt' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email ikke konfigureret' });

  const to   = process.env.CONTACT_EMAIL || 'info@avancert.dk';
  const from = process.env.RESEND_FROM   || 'Avancert hjemmeside <onboarding@resend.dev>';

  const formType = clean(b.formType);
  let subject, text, replyTo;

  if (formType === 'tilbudsinfo') {
    const firmanavn      = clean(b.firmanavn);
    const cvr            = clean(b.cvr);
    const kontakt        = clean(b.kontakt);
    const telefon        = clean(b.telefon);
    const email          = clean(b.email);
    const vejnavn        = clean(b.vejnavn);
    const postnr         = clean(b.postnr);
    const by             = clean(b.by);
    const website        = clean(b.website);
    const medarbejdere   = clean(b.medarbejdere);
    const standards      = clean(b.standards);
    const andre_std      = clean(b.andre_std);
    const lokationer     = clean(b.lokationer);
    const allerede_cert  = clean(b.allerede_cert);
    const nuv_standarder = clean(b.nuv_standarder);
    const konsulent      = clean(b.konsulent);
    const hvad_laver     = clean(b.hvad_laver);
    const funktioner     = clean(b.funktioner);
    const outsourcing    = clean(b.outsourcing);

    if (!firmanavn && !kontakt) return res.status(400).json({ error: 'Mangler firmanavn' });

    subject = `Tilbudsinfo: ${firmanavn || kontakt}`;
    text = [
      '=== VIRKSOMHEDSOPLYSNINGER ===',
      `Firmanavn: ${firmanavn}`,
      `CVR. Nr.: ${cvr}`,
      `Kontaktperson: ${kontakt}`,
      `Telefon: ${telefon}`,
      `E-mail: ${email}`,
      `Adresse: ${vejnavn}, ${postnr} ${by}`.trim().replace(/^,\s*/, ''),
      `Hjemmeside: ${website}`,
      `Antal medarbejdere: ${medarbejdere}`,
      '',
      '=== ØNSKEDE STANDARDER ===',
      standards || 'Ingen markeret',
      andre_std ? `Andre: ${andre_std}` : '',
      '',
      '=== EKSTRA LOKATIONER ===',
      lokationer || 'Ingen',
      '',
      '=== NUVÆRENDE CERTIFICERING ===',
      `Allerede certificeret: ${allerede_cert}`,
      `Standarder/udløb/overdragelse: ${nuv_standarder}`,
      `Konsulentvirksomhed: ${konsulent}`,
      '',
      '=== OM VIRKSOMHEDEN ===',
      `Hvad laver virksomheden:\n${hvad_laver}`,
      '',
      `Medarbejdere fordelt på funktioner:\n${funktioner}`,
      '',
      `Outsourcede processer:\n${outsourcing}`,
    ].join('\n');

    if (email && isValidEmail(email)) replyTo = email;

  } else if (formType === 'tilbud') {
    const company  = clean(b.company);
    const name     = clean(b.name);
    const email    = clean(b.email);
    const phone    = clean(b.phone);
    const size     = clean(b.size);
    const certified = clean(b.certified);
    const standards = clean(b.standards);

    if (!company && !name) return res.status(400).json({ error: 'Mangler firmanavn' });

    subject = `Tilbudsforespørgsel: ${company || name}`;
    text = [
      'STANDARDER',
      `Ønskede standarder: ${standards || 'Ikke valgt'}`,
      '',
      'VIRKSOMHED',
      `Firmanavn: ${company}`,
      `Antal medarbejdere: ${size}`,
      `Allerede certificeret: ${certified}`,
      '',
      'KONTAKT',
      `Navn: ${name}`,
      `Telefon: ${phone}`,
      `Email: ${email}`,
    ].join('\n');

    if (email && isValidEmail(email)) replyTo = email;

  } else {
    const name    = clean(b.name);
    const email   = clean(b.email);
    const type    = clean(b.type) || 'Klage';
    const company = clean(b.company);
    const message = clean(b.message);

    if (!name)    return res.status(400).json({ error: 'Mangler navn' });
    if (!message) return res.status(400).json({ error: 'Mangler beskrivelse' });

    subject = `Henvendelse (${type}): ${name}`;
    text = [
      `Type: ${type}`,
      `Navn: ${name}`,
      `Email: ${email}`,
      `Virksomhed: ${company}`,
      '',
      'Beskrivelse:',
      message,
    ].join('\n');

    if (email && isValidEmail(email)) replyTo = email;
  }

  try {
    // Hoved-mail til info@
    await send(apiKey, from, {
      from,
      to: [to],
      ...(replyTo ? { reply_to: [replyTo] } : {}),
      subject,
      text,
    });

    // Kvitteringsmail til afsender
    if (replyTo) {
      const isTilbudsinfo = formType === 'tilbudsinfo';
      const isOffer = formType === 'tilbud' || isTilbudsinfo;
      const senderName = clean(b.name || b.kontakt);
      await send(apiKey, from, {
        from,
        to: [replyTo],
        subject: isTilbudsinfo
          ? 'Vi har modtaget jeres virksomhedsoplysninger'
          : isOffer
            ? 'Vi har modtaget jeres tilbudsforespørgsel'
            : 'Vi har modtaget jeres henvendelse',
        text: [
          `Hej ${senderName},`,
          '',
          isTilbudsinfo
            ? 'Tak for jeres oplysninger. Vi gennemgår dem og vender tilbage hurtigst muligt med et konkret tilbud.'
            : isOffer
              ? 'Tak for jeres forespørgsel. Vi vender tilbage hurtigst muligt med et konkret tilbud.'
              : 'Tak for jeres henvendelse. Vi behandler den hurtigst muligt.',
          '',
          'Har I spørgsmål undervejs, er I altid velkomne til at ringe på 36 16 36 16.',
          '',
          'Med venlig hilsen',
          'Avancert ApS',
          'avancert.dk | info@avancert.dk | 36 16 36 16',
        ].join('\n'),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Email kunne ikke sendes', details: err.details });
  }
};
