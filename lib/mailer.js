const https = require('https');

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'dev69440@gmail.com';

const sendBrevo = (payload) => {
  return new Promise((resolve, reject) => {
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
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error(`Brevo error ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

const sendOtp = async (to, otp) => {
  await sendBrevo({
    sender: { name: 'FitTrack', email: SENDER_EMAIL },
    to: [{ email: to }],
    subject: 'Your FitTrack verification code',
    htmlContent: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#22c55e">FitTrack</h2>
        <p>Your verification code is:</p>
        <div style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#111;margin:24px 0">${otp}</div>
        <p style="color:#666">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#999;font-size:12px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
};

const sendWeeklySummary = async (to, name, { workoutCount, totalMinutes, totalSets, topLifts }) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const liftRows = topLifts.map(l =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6">${l.name}</td>
     <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#22c55e">${l.max_weight}kg</td></tr>`
  ).join('');

  await sendBrevo({
    sender: { name: 'FitTrack', email: SENDER_EMAIL },
    to: [{ email: to }],
    subject: `Your weekly FitTrack summary 💪`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="color:#22c55e;margin-bottom:4px">FitTrack</h2>
        <p style="color:#666;margin-top:0">Weekly Summary</p>
        <p>Hey <strong>${name}</strong> 👋 Here's what you accomplished last week:</p>
        <div style="display:flex;gap:16px;margin:24px 0">
          <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:#22c55e">${workoutCount}</div>
            <div style="font-size:12px;color:#666">Workouts</div>
          </div>
          <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:#22c55e">${timeStr}</div>
            <div style="font-size:12px;color:#666">Time Trained</div>
          </div>
          <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:bold;color:#22c55e">${totalSets}</div>
            <div style="font-size:12px;color:#666">Total Sets</div>
          </div>
        </div>
        ${topLifts.length > 0 ? `
        <p style="font-weight:600">Top lifts this week:</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666">Exercise</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666">Max Weight</th>
          </tr></thead>
          <tbody>${liftRows}</tbody>
        </table>` : ''}
        <p style="margin-top:24px">Keep it up! See you in the gym 🏋️</p>
        <p style="color:#999;font-size:11px;margin-top:32px">FitTrack · You're receiving this because you have an account.</p>
      </div>
    `,
  });
};

module.exports = { sendOtp, sendWeeklySummary };
