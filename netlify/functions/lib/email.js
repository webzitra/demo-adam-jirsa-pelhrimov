/**
 * Email notifications via Resend API
 * Requires RESEND_API_KEY env variable
 * Optionally set NOTIFICATION_EMAIL (defaults to Adam's email)
 */

const RESEND_API = 'https://api.resend.com/emails';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Adam Jirsa Web <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return { skipped: true };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', res.status, err);
      return { error: err, status: res.status };
    }

    return await res.json();
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { error: err.message };
  }
}

// --- Notification: New client registered ---
async function notifyNewRegistration(client) {
  const adminEmail = process.env.NOTIFICATION_EMAIL || 'jirsafitness@gmail.com';

  return sendEmail({
    to: adminEmail,
    subject: `Nový klient: ${client.name}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #56C8E0; margin-bottom: 16px;">Nová registrace na webu</h2>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 4px 0;"><strong>Jméno:</strong> ${client.name}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${client.email}</p>
          ${client.phone ? `<p style="margin: 4px 0;"><strong>Telefon:</strong> ${client.phone}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Datum:</strong> ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</p>
        </div>
        <p style="color: #666; font-size: 14px;">
          Klient se zaregistroval na adamjirsa.cz a vyplní vstupní dotazník.
          Přihlaš se do <a href="https://adamjirsa.cz/admin/" style="color: #56C8E0;">admin zóny</a> a nastav mu tréninkový plán.
        </p>
      </div>
    `,
  });
}

// --- Welcome email to new client ---
async function sendWelcomeEmail(client) {
  return sendEmail({
    to: client.email,
    subject: 'Vítej v týmu! — Adam Jirsa Fitness',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #56C8E0; margin-bottom: 16px;">Ahoj ${client.name.split(' ')[0]}!</h2>
        <p>Díky za registraci. Tvůj účet je aktivní a můžeš se přihlásit do <a href="https://adamjirsa.cz/zona/" style="color: #56C8E0;">klientské zóny</a>.</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Co teď?</strong></p>
          <ol style="padding-left: 20px; margin: 8px 0;">
            <li>Vyplň vstupní dotazník (zobrazí se po přihlášení)</li>
            <li>Já ti na základě odpovědí připravím plán na míru</li>
            <li>Začneš trénovat!</li>
          </ol>
        </div>
        <p>Pokud máš jakékoliv dotazy, napiš mi na <a href="mailto:jirsafitness@gmail.com" style="color: #56C8E0;">jirsafitness@gmail.com</a> nebo zavolej na <a href="tel:+420731613480" style="color: #56C8E0;">731 613 480</a>.</p>
        <p style="margin-top: 20px;">Těším se na spolupráci!<br><strong>Adam Jirsa</strong></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Tento email byl odeslán automaticky z adamjirsa.cz</p>
      </div>
    `,
  });
}

module.exports = { sendEmail, notifyNewRegistration, sendWelcomeEmail };
