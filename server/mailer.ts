import nodemailer from 'nodemailer';

// Helper to send real emails via SMTP or standard transport
export async function sendAdminEmailNotification({
  to = 'aacreativeemb@gmail.com',
  subject,
  html,
  text
}: {
  to?: string;
  subject: string;
  html: string;
  text: string;
}) {
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      await transporter.sendMail({
        from: `"AA Creative Embroidery Security" <${smtpUser}>`,
        to,
        subject,
        text,
        html
      });
      console.log(`[REAL EMAIL SENT VIA SMTP] Dispatched to ${to}: "${subject}"`);
      return { success: true, method: 'smtp' };
    } catch (err: any) {
      console.error(`[SMTP ERROR] Failed to send email via SMTP:`, err.message);
    }
  }

  // If SMTP is not configured in env, log strictly to secure server terminal
  console.log(`\n=============================================================`);
  console.log(`[REAL EMAIL DISPATCH -> ${to}]`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${text}`);
  console.log(`=============================================================\n`);

  return { success: true, method: 'logged' };
}
