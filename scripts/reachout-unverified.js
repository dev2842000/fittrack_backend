/**
 * One-time script: reach out to users who signed up but never verified their email.
 * Run: node scripts/reachout-unverified.js
 */

require('dotenv').config();
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'dev69440@gmail.com';

const sendBrevo = (payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`Brevo ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

const sendReachout = (name, email) =>
  sendBrevo({
    sender: { name: 'FitTrack', email: SENDER_EMAIL },
    to: [{ email, name }],
    subject: "We fixed it — come give FitTrack another shot 💪",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="color:#22c55e">FitTrack</h2>
        <p>Hey <strong>${name}</strong>,</p>
        <p>
          We noticed you tried to sign up for FitTrack recently but ran into an issue
          with the email verification code — that was on us, and we're sorry for the friction.
        </p>
        <p>The good news: <strong>it's fixed now.</strong></p>
        <p>
          Head back and sign up again — it'll take less than a minute and your workouts
          will be waiting for you on the other side.
        </p>
        <a href="https://fittrack-frontend-three.vercel.app"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#22c55e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Try FitTrack Again →
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">
          If you no longer want to hear from us, just ignore this — we won't email you again.
        </p>
      </div>
    `,
  });

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, email, created_at
     FROM users
     WHERE is_verified = FALSE
     ORDER BY created_at DESC`
  );

  if (rows.length === 0) {
    console.log('No unverified users found.');
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} unverified user(s):\n`);

  let sent = 0, failed = 0;

  for (const user of rows) {
    try {
      await sendReachout(user.name, user.email);
      console.log(`✓ Sent to ${user.email} (${user.name})`);
      sent++;
      // Small delay to stay within Brevo rate limits
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`✗ Failed for ${user.email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
