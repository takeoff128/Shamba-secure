const nodemailer = require('nodemailer');

// Provider-agnostic: works with Gmail (with an app password), SendGrid,
// Mailgun, Postmark, or any other SMTP relay — just set these env vars.
// If they're not set, reset links are logged to the console instead of
// emailed, so the app still runs locally without an email account.
let transporter = null;
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
} else {
  console.log('[email] SMTP_HOST/SMTP_USER/SMTP_PASS not set — emails will be logged, not sent. See .env.example.');
}

async function sendEmail(to, subject, html) {
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

async function sendPasswordResetEmail(to, resetUrl, farmName) {
  const subject = 'Reset your Shamba Secure password';
  const html = `
    <p>Hello,</p>
    <p>Someone requested a password reset for the ${farmName ? `"${farmName}" ` : ''}Shamba Secure account linked to this email.</p>
    <p><a href="${resetUrl}">Click here to set a new password</a></p>
    <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>
  `;
  return sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendPasswordResetEmail };
