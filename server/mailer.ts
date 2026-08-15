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
  const smtpUser = (config.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || 'aacreativeemb@gmail.com').trim();
  // Strip all spaces from 16-digit Google App Passwords
  const rawPass = (config.smtpPass || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
  const smtpPass = rawPass.replace(/\s+/g, '');
  const smtpHost = (config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const resendApiKey = (config.resendApiKey || process.env.RESEND_API_KEY || '').trim();

  // 1. Try Resend API if API Key provided
  if (resendApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
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
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

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

  // 2. Try SMTP with Gmail App Password (with strict timeouts & dual-port fallback)
  if (smtpUser && smtpPass) {
    // Attempt 1: Port 465 (SSL)
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000
      });

      await transporter.sendMail({
        from: `"AA Creative Support Desk" <${smtpUser}>`,
        to,
        subject,
        text,
        html
      });

      console.log(`[REAL EMAIL SENT VIA SMTP 465] Dispatched to ${to}: "${subject}"`);
      return { success: true, method: 'smtp (SSL 465)' };
    } catch (err465: any) {
      console.warn(`[SMTP 465 Attempt Failed] ${err465.message}, trying Port 587 (STARTTLS)...`);

      // Attempt 2: Port 587 (STARTTLS)
      try {
        const transporter587 = nodemailer.createTransport({
          host: smtpHost,
          port: 587,
          secure: false,
          requireTLS: true,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 8000,
          tls: {
            rejectUnauthorized: false
          }
        });

        await transporter587.sendMail({
          from: `"AA Creative Support Desk" <${smtpUser}>`,
          to,
          subject,
          text,
          html
        });

        console.log(`[REAL EMAIL SENT VIA SMTP 587] Dispatched to ${to}: "${subject}"`);
        return { success: true, method: 'smtp (TLS 587)' };
      } catch (err587: any) {
        console.error(`[SMTP ERROR] Both Port 465 and 587 failed:`, err587.message);
        return {
          success: false,
          method: 'smtp_failed',
          error: `Google SMTP Error: ${err587.message}. Please make sure 2-Step Verification is active on ${smtpUser} and you generated an App Password from https://myaccount.google.com/apppasswords.`
        };
      }
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
