import "server-only"
import { Resend } from "resend"
import { serverEnv } from "@/lib/env.server"

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)

/** Sends an email via Resend. Returns false (never throws) when email is not configured or sending fails. */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!serverEnv.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set; email not sent")
    return false
  }
  const resend = new Resend(serverEnv.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: serverEnv.EMAIL_FROM ?? "Clunite <onboarding@resend.dev>",
    to,
    subject,
    html,
  })
  if (error) {
    console.error("[email] send failed:", error.message)
    return false
  }
  return true
}

/** Minimal, accessible code email (code shown large, monospace). */
export function codeEmail({ heading, intro, code, footer }: { heading: string; intro: string; code: string; footer: string }) {
  return `<!doctype html><html><body style="margin:0;background:#FAF9F6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#1F1E1D">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="background:#FFFFFF;border:1px solid #E8E6E1;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:18px">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#6B6A66">${escapeHtml(intro)}</p>
      <div style="font-size:28px;letter-spacing:8px;font-weight:700;text-align:center;padding:16px;border:1px solid #E8E6E1;border-radius:10px;background:#FAF9F6">${escapeHtml(code)}</div>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6B6A66">${escapeHtml(footer)}</p>
    </div>
  </div></body></html>`
}
