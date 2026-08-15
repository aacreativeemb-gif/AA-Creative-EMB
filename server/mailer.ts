import nodemailer from 'nodemailer';
import { globalStore } from './store';

// Helper to send real emails via SMTP, Gmail App Password, or Resend
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
}): Promise<{ success: boolean; method: string; error?: string }> {
  const config = globalStore.emailConfig;
  const smtpUser = config.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || 'aacreativeemb@gmail.com';
  const smtpPass = (config.smtpPass || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
  const smtpHost = config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = config.smtpPort || parseInt(process.env.SMTP_PORT || '465', 10);
  const resendApiKey = (config.resendApiKey || process.env.RESEND_API_KEY || '').trim();

  // 1. Try Resend API if API Key provided
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'AA Creative Embroidery Support <onboarding@resend.dev>',
          to: [to],
          subject,
          text,
          html
        })
      });

      if (res.ok) {
        console.log(`[RESEND API EMAIL SENT] Dispatched to ${to}: "${subject}"`);
        return { success: true, method: 'resend' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[RESEND ERROR] Failed:`, errorData);
      }
    } catch (err: any) {
      console.error(`[RESEND EXCEPTION]`, err.message);
    }
  }

  // 2. Try SMTP (Gmail App Password or Custom SMTP)
  if (smtpUser && smtpPass) {
    try {
      const isGmail = smtpHost.includes('gmail');
      const transporter = nodemailer.createTransport(
        isGmail
          ? {
              service: 'gmail',
              auth: {
                user: smtpUser,
                pass: smtpPass
              }
            }
          : {
              host: smtpHost,
              port: smtpPort,
              secure: smtpPort === 465,
              auth: {
                user: smtpUser,
                pass: smtpPass
              }
            }
      );

      await transporter.sendMail({
        from: `"AA Creative Support Desk" <${smtpUser}>`,
        to,
        subject,
        text,
        html
      });

      console.log(`[REAL EMAIL SENT VIA SMTP] Dispatched to ${to}: "${subject}"`);
      return { success: true, method: 'smtp' };
    } catch (err: any) {
      console.error(`[SMTP ERROR] Failed to send email via SMTP:`, err.message);
      return {
        success: false,
        method: 'smtp_failed',
        error: `SMTP Error: ${err.message}. Please check if you used a 16-character Google App Password (not your normal Gmail password).`
      };
    }
  }

  // 3. Fallback when credentials are not yet set
  console.log(`\n=============================================================`);
  console.log(`[EMAIL DISPATCH NOTICE - Credentials needed for actual delivery]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${text}`);
  console.log(`=============================================================\n`);

  return {
    success: false,
    method: 'no_smtp_configured',
    error: 'SMTP password / Google App Password is not yet entered in Settings or Environment Variables.'
  };
}
