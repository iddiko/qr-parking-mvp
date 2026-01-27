import { Resend } from "resend";
import { inviteEmailTemplate, scanEmailTemplate } from "./templates";

const resendKey = process.env.RESEND_API_KEY ?? "";
const resendFrom = process.env.RESEND_FROM_EMAIL ?? "no-reply@noblepay.uk";

const resend = resendKey ? new Resend(resendKey) : null;

type EmailResult = { ok: boolean; error?: string };

async function sendEmail(payload: { to: string; subject: string; html: string }): Promise<EmailResult> {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is missing." };
  }
  try {
    await resend.emails.send({
      from: resendFrom,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed.";
    return { ok: false, error: message };
  }
}

export async function sendInviteEmail(payload: { email: string; token: string }): Promise<EmailResult> {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/auth/invite?token=${payload.token}`;
  const template = inviteEmailTemplate(link);
  return sendEmail({ to: payload.email, subject: template.subject, html: template.html });
}

export async function sendScanEmail(payload: {
  email: string;
  timestamp: string;
  location: string;
  locationLat?: number | null;
  locationLng?: number | null;
  result: string;
  vehiclePlate?: string | null;
}): Promise<EmailResult> {
  const template = scanEmailTemplate(payload);
  return sendEmail({ to: payload.email, subject: template.subject, html: template.html });
}
