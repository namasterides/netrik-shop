const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER || 'namasterides26@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'namasterides26@gmail.com';

function mailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function toText(payload) {
  const {
    restaurantName,
    ownerName,
    subscription,
    domain,
    address,
    contact,
    managerCreds,
    chefCreds,
    serverCreds,
    supportEmail,
    supportPhone,
  } = payload;

  const serverCredsList = (serverCreds || []).map((s, i) => 
    `${s.name}:\nUser ID  : ${s.userId}\nPassword : ${s.password}`
  ).join('\n\n');

  return [
    `Welcome to Netrik Shop, ${ownerName || 'Restaurant Team'}!`,
    '',
    `Your workspace for ${restaurantName} is now active.`,
    '',
    '--- RESTAURANT DETAILS ---',
    `Restaurant Name : ${restaurantName}`,
    `Subscription  : ${subscription}`,
    `Domain        : ${domain || '-'}`,
    `Address       : ${address || '-'}`,
    `Contact       : ${contact || '-'}`,
    '',
    '--- ACCESS CREDENTIALS ---',
    '',
    'Manager Dashboard:',
    `User ID  : ${managerCreds?.userId || '-'}`,
    `Password : ${managerCreds?.password || '-'}`,
    '',
    'Chef / Kitchen Dashboard:',
    `User ID  : ${chefCreds?.userId || '-'}`,
    `Password : ${chefCreds?.password || '-'}`,
    '',
    ...(serverCreds?.length ? [
      'Server / Waiter Accounts:',
      serverCredsList,
      ''
    ] : []),
    '--- NEED ASSISTANCE? ---',
    `Email: ${supportEmail}`,
    `Phone / WhatsApp: ${supportPhone}`,
    '',
    'Thank you for choosing Netrik Shop. We look forward to powering your success.',
  ].join('\n');
}

function toHtml(payload) {
  const {
    restaurantName,
    ownerName,
    subscription,
    domain,
    address,
    contact,
    managerCreds,
    chefCreds,
    serverCreds,
    supportEmail,
    supportPhone,
  } = payload;

  const row = (label, value) => `
    <tr>
      <td style="padding:14px 16px;color:#6b7280;font-size:14px;border-bottom:1px solid #e5e7eb;width:40%;">${label}</td>
      <td style="padding:14px 16px;color:#111827;font-size:14px;border-bottom:1px solid #e5e7eb;font-weight:500;">${value || '-'}</td>
    </tr>`;

  const serverCredsHtml = (serverCreds || []).map(s => `
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;margin-bottom:12px;">
        <div style="background-color:#f59e0b;color:white;font-size:10px;font-weight:bold;padding:4px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:1px;">${s.name}</div>
      </div>
      <div style="margin-bottom:8px;font-size:14px;"><span style="color:#64748b;display:inline-block;width:80px;">User ID:</span> <strong style="color:#0f172a;font-family:monospace;font-size:15px;">${s.userId}</strong></div>
      <div style="font-size:14px;"><span style="color:#64748b;display:inline-block;width:80px;">Password:</span> <strong style="color:#0f172a;font-family:monospace;font-size:15px;">${s.password}</strong></div>
    </div>
  `).join('');

  return `
    <div style="background-color:#f3f4f6;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#374151;line-height:1.6;">
      <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="background-color:#0f172a;padding:30px;text-align:center;">
          <div style="color:#ffffff;font-weight:700;font-size:24px;letter-spacing:-0.5px;">Netrik Shop</div>
          <div style="color:#94a3b8;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Restaurant OS</div>
        </div>

        <!-- Body -->
        <div style="padding:40px 30px;">
          <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">Welcome aboard, ${ownerName || 'Team'}!</h1>
          <p style="margin:0 0 30px 0;font-size:16px;color:#4b5563;">Your premium workspace for <strong>${restaurantName}</strong> has been successfully provisioned. Below are your official system credentials and restaurant details.</p>

          <!-- Details Table -->
          <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin:0 0 10px 0;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Workspace Details</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
            ${row('Restaurant Name', restaurantName)}
            ${row('Subscription Plan', subscription)}
            ${row('Custom Domain', domain || '-')}
            ${row('Address', address || '-')}
            ${row('Contact Number', contact || '-')}
          </table>

          <!-- Credentials -->
          <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin:0 0 10px 0;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Access Credentials</h2>
          
          <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;margin-bottom:12px;">
              <div style="background-color:#2563eb;color:white;font-size:10px;font-weight:bold;padding:4px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:1px;">Manager Panel</div>
            </div>
            <div style="margin-bottom:8px;font-size:14px;"><span style="color:#64748b;display:inline-block;width:80px;">User ID:</span> <strong style="color:#0f172a;font-family:monospace;font-size:15px;">${managerCreds?.userId || '-'}</strong></div>
            <div style="font-size:14px;"><span style="color:#64748b;display:inline-block;width:80px;">Password:</span> <strong style="color:#0f172a;font-family:monospace;font-size:15px;">${managerCreds?.password || '-'}</strong></div>
          </div>

          <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;margin-bottom:12px;">
              <div style="background-color:#059669;color:white;font-size:10px;font-weight:bold;padding:4px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:1px;">Chef Panel</div>
            </div>
            <div style="margin-bottom:8px;font-size:14px;"><span style="color:#64748b;display:inline-block;width:80px;">User ID:</span> <strong style="color:#0f172a;font-family:monospace;font-size:15px;">${chefCreds?.userId || '-'}</strong></div>
            <div style="font-size:14px;"><span style="color:#64748b;display:inline-block;width:80px;">Password:</span> <strong style="color:#0f172a;font-family:monospace;font-size:15px;">${chefCreds?.password || '-'}</strong></div>
          </div>

          ${serverCredsHtml}

          <!-- Login Button -->
          <div style="text-align:center;margin-bottom:40px;">
            <a href="https://netrik-mu.vercel.app/login" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:6px;">Login to Dashboard</a>
          </div>

          <!-- Support -->
          <div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:0 8px 8px 0;">
            <div style="color:#1d4ed8;font-weight:600;font-size:14px;margin-bottom:4px;">Need Assistance?</div>
            <div style="color:#1e3a8a;font-size:13px;line-height:1.5;">Our enterprise support team is available 24/7.</div>
            <div style="margin-top:8px;font-size:13px;color:#1e3a8a;">
              <strong>Email:</strong> <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;">${supportEmail}</a><br>
              <strong>Phone:</strong> <a href="https://wa.me/16562145190" style="color:#2563eb;text-decoration:none;">${supportPhone}</a>
            </div>
          </div>

        </div>
        
        <!-- Footer -->
        <div style="background-color:#f8fafc;padding:24px 30px;text-align:center;border-top:1px solid #e5e7eb;">
          <div style="color:#94a3b8;font-size:12px;line-height:1.5;">
            This email was sent automatically by Netrik Shop.<br>
            Please keep your credentials secure and do not share them.
          </div>
        </div>

      </div>
    </div>`;
}

export async function sendRestaurantOnboardingEmail(payload) {
  if (!payload?.toEmail) return { sent: false, reason: 'missing-recipient' };
  if (!mailConfigured()) {
    console.warn('[mail] SMTP not configured, skipped send to:', payload.toEmail);
    return { sent: false, reason: 'smtp-not-configured' };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Netrik Shop" <${SMTP_FROM}>`,
      to: payload.toEmail,
      subject: `Welcome to Netrik Shop - Credentials for ${payload.restaurantName}`,
      text: toText(payload),
      html: toHtml(payload),
    });

    return { sent: true };
  } catch (error) {
    console.error('[mail] Failed to send onboarding email:', error);
    return { sent: false, reason: 'smtp-error' };
  }
}
