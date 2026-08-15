import nodemailer from 'nodemailer';
import dns from 'dns';
import { globalStore } from './store';

// Ensure Node.js prefers IPv4 over IPv6 on cloud hosts like Render/Cloud Run
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // Ignore if not supported in runtime
  }
}

// Helper to resolve IPv4 address for SMTP host
async function getIpv4Host(hostname: string): Promise<string> {
  return new Promise((resolve) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (!err && address) {
        resolve(address);
      } else {
        resolve(hostname);
      }
    });
  });
}

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
  const rawHost = (config.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const resendApiKey = (config.resendApiKey || process.env.RESEND_API_KEY || '').trim();

  // 1. Try SMTP with Gmail App Password first (forced IPv4)
  if (smtpUser && smtpPass) {
    // Resolve pure IPv4 address or fallback to hostname
    const resolvedIpv4 = await getIpv4Host(rawHost);

    // Attempt 1: Port 465 (SSL + IPv4)
    try {
      const transporter = nodemailer.createTransport({
        host: resolvedIpv4,
        port: 465,
        secure: true,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        name: 'aacreativeemb.com',
        tls: {
          servername: rawHost,
          rejectUnauthorized: false
        },
        connectionTimeout: 9000,
        greetingTimeout: 9000,
        socketTimeout: 9000
      });

      await transporter.sendMail({
        from: `"AA Creative Support Desk" <${smtpUser}>`,
        to,
        subject,
        text,
        html
      });

      console.log(`[REAL EMAIL SENT VIA GMAIL SMTP 465] Dispatched to ${to}: "${subject}"`);
      return { success: true, method: 'Gmail SMTP (Port 465 SSL)' };
    } catch (err465: any) {
      console.warn(`[SMTP 465 Attempt Failed] ${err465.message}, trying Port 587 (STARTTLS IPv4)...`);

      // Attempt 2: Port 587 (STARTTLS + IPv4)
      try {
        const transporter587 = nodemailer.createTransport({
          host: resolvedIpv4,
          port: 587,
          secure: false,
          requireTLS: true,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          name: 'aacreativeemb.com',
          tls: {
            servername: rawHost,
            rejectUnauthorized: false
          },
          connectionTimeout: 9000,
          greetingTimeout: 9000,
          socketTimeout: 9000
        });

        await transporter587.sendMail({
          from: `"AA Creative Support Desk" <${smtpUser}>`,
          to,
          subject,
          text,
          html
        });

        console.log(`[REAL EMAIL SENT VIA GMAIL SMTP 587] Dispatched to ${to}: "${subject}"`);
        return { success: true, method: 'Gmail SMTP (Port 587 TLS)' };
      } catch (err587: any) {
        console.error(`[SMTP ERROR] IPv4 Port 465 & 587 failed:`, err587.message);
        console.warn(`[SMTP FAILED] Falling back to Resend API if configured...`);
      }
    }
  }

  // 2. Fallback to Resend API if Gmail SMTP failed or credentials not set
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
          from: 'AA Creative Support <support@aacreativeemb.com>',
          to: [to],
          subject,
          text,
          html
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        console.log(`[RESEND API EMAIL SENT - FALLBACK] Dispatched to ${to}: "${subject}"`);
        return { success: true, method: 'Resend API (Fallback, HTTP 443)' };
      } else {
        const errorData: any = await res.json().catch(() => ({}));
        console.error(`[RESEND ERROR] Failed:`, errorData);
        return {
          success: false,
          method: 'resend_failed',
          error: `Both Gmail SMTP and Resend API failed. Resend error: ${JSON.stringify(errorData)}`
        };
      }
    } catch (err: any) {
      console.error(`[RESEND EXCEPTION]`, err.message);
      return {
        success: false,
        method: 'resend_exception',
        error: `Both Gmail SMTP and Resend API failed. Resend error: ${err.message}`
      };
    }
  }

  // 3. Fallback when no credentials are set at all
  console.log(`\n=============================================================`);
  console.log(`[EMAIL DISPATCH NOTICE - Credentials needed for actual delivery]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${text}`);
  console.log(`=============================================================\n`);

  return {
    success: false,
    method: 'no_smtp_configured',
    error: 'Google App Password is not yet saved.'
  };
}

