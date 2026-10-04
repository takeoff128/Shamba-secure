const nodemailer = require('nodemailer');

// Two ways to actually deliver email, tried in this order:
//
// 1. Resend (HTTP API) — set RESEND_API_KEY. Preferred on hosts like
//    Railway's Free/Hobby plans, which block outbound SMTP (ports 465/587)
//    entirely; an HTTPS API call isn't affected by that restriction.
//    Without a verified domain in Resend, RESEND_FROM must stay
//    "onboarding@resend.dev" and can only deliver to the email address the
//    Resend account itself was signed up with — fine for testing, not for
//    real users. Verify a domain at resend.com/domains to email anyone.
//
// 2. SMTP (nodemailer) — set SMTP_HOST/SMTP_USER/SMTP_PASS. Works with
//    Gmail (app password), SendGrid, Mailgun, Postmark, etc. — but only on
//    hosts that actually allow outbound SMTP (e.g. Railway Pro+, not
//    Free/Hobby).
//
// If neither is configured, emails are logged to the console instead, so
// the app still runs locally without any email account at all.
const { RESEND_API_KEY, RESEND_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let transporter = null;
if (!RESEND_API_KEY && SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Without these, a misconfigured/unreachable/blocked SMTP host can hang
    // the connection attempt for minutes, which hangs the request that
    // triggered it (e.g. registration) right along with it.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

if (!RESEND_API_KEY && !transporter) {
  console.log('[email] Neither RESEND_API_KEY nor SMTP_HOST/SMTP_USER/SMTP_PASS set — emails will be logged, not sent. See .env.example.');
}

async function sendViaResend(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: RESEND_FROM || 'onboarding@resend.dev', to, subject, html })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Resend API error (${res.status})`);
  }
  return res.json();
}

async function sendEmail(to, subject, html) {
  if (RESEND_API_KEY) {
    return sendViaResend(to, subject, html);
  }
  if (!transporter) {
    console.log(`[email:not-configured] to=${to} subject="${subject}"\n${html}`);
    return { simulated: true };
  }
  return transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    html
  });
}

async function sendPasswordResetCodeEmail(to, code, farmName) {
  const subject = 'Your Shamba Secure password reset code';
  const html = `
    <p>Hello,</p>
    <p>Someone requested a password reset for the ${farmName ? `"${farmName}" ` : ''}Shamba Secure account linked to this email. Use this code to set a new password:</p>
    <p style="font-size:28px; font-weight:700; letter-spacing:4px;">${code}</p>
    <p>This code expires in 15 minutes. If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `;
  return sendEmail(to, subject, html);
}

async function sendVerificationCodeEmail(to, code, farmName) {
  const subject = 'Verify your email for Shamba Secure';
  const html = `
    <p>Hello,</p>
    <p>Use this code to verify the email address on your ${farmName ? `"${farmName}" ` : ''}Shamba Secure account:</p>
    <p style="font-size:28px; font-weight:700; letter-spacing:4px;">${code}</p>
    <p>This code expires in 15 minutes. If you didn't create this account, you can safely ignore this email.</p>
  `;
  return sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendPasswordResetCodeEmail, sendVerificationCodeEmail };
