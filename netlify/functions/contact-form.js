const { sendEmail } = require('./lib/email');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, phone, service, message, formName } = body;

  if (!name || !email) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Jméno a email jsou povinné' }),
    };
  }

  // Basic validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Neplatný email' }),
    };
  }

  // Honeypot
  if (body.website) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  }

  const adminEmail = process.env.NOTIFICATION_EMAIL || 'lukas.palecek2@gmail.com';
  const serviceName = service || 'Neuvedeno';

  const result = await sendEmail({
    to: adminEmail,
    subject: `Nová poptávka: ${name} — ${serviceName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #56C8E0; margin-bottom: 16px;">Nová poptávka z webu</h2>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 4px 0;"><strong>Jméno:</strong> ${name}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p style="margin: 4px 0;"><strong>Telefon:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
          <p style="margin: 4px 0;"><strong>Služba:</strong> ${serviceName}</p>
          ${message ? `<p style="margin: 4px 0;"><strong>Zpráva:</strong> ${message}</p>` : ''}
        </div>
        <p style="color: #666; font-size: 14px;">Formulář: ${formName || 'kontakt'} | ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</p>
      </div>
    `,
  });

  if (result.error && !result.skipped) {
    console.error('Contact form email failed:', JSON.stringify(result));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Nepodařilo se odeslat. Zkuste to znovu.', detail: result.error }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  };
};
