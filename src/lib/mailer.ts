import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || SMTP_USER || "noreply@example.com";
const SMTP_SECURE = (process.env.SMTP_SECURE || "").toLowerCase() === "true";

function canSend() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);
}

let transporter: nodemailer.Transporter | null = null;
// Resend integration removed; using Nodemailer only

export function getTransporter() {
  if (!canSend()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE || SMTP_PORT === 465,
      auth: { user: SMTP_USER!, pass: SMTP_PASS! },
    });
    // Verify connection configuration (non-blocking diagnostics)
    transporter.verify((error, success) => {
      if (error) {
        console.error('[mailer] SMTP verify failed:', error);
      } else {
        console.log('[mailer] SMTP server is ready to send messages');
      }
    });
  }
  return transporter;
}

export async function sendInvitationEmail(opts: {
  to: string;
  acceptUrl: string;
  projectName: string;
  invitedBy?: string | null;
}) {
  const tx = getTransporter();
  const subject = `You're invited to join project: ${opts.projectName}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
      <h2>Project Invitation</h2>
      <p>You have been invited to join the project <strong>${opts.projectName}</strong>.</p>
      <p>Click the button below to accept the invitation:</p>
      <p>
        <a href="${opts.acceptUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;text-decoration:none;border-radius:6px">Accept Invitation</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <code>${opts.acceptUrl}</code>
      <p style="color:#6b7280;font-size:12px;margin-top:16px;">If you didn't expect this email, you can ignore it.</p>
    </div>
  `;

  if (!tx) {
    // SMTP not configured: stub out and log
    console.log(`[invite-email-stub] to=${opts.to} subject="${subject}" url=${opts.acceptUrl}`);
    return;
  }
  try {
    const info = await tx.sendMail({
      from: SMTP_FROM,
      to: opts.to,
      subject,
      html,
    });
    console.log('[mailer] Invitation email sent:', { to: opts.to, messageId: info.messageId });
  } catch (err) {
    console.error('[mailer] Failed to send invitation email:', err);
    // Do not throw to avoid breaking project creation; invites will still appear in dashboard
  }
}
