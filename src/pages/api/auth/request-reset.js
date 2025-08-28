// /src/pages/api/auth/request-reset.js
import jwt from "jsonwebtoken";
import pool from "@/lib/db";
import { sendMail } from "@/lib/o365";

const BASE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MINUTES || "15", 10);
const SECRET = process.env.RESET_TOKEN_SECRET;
const DEBUG = process.env.DEBUG_RESET === "1";

// Keep quotes if your table name is mixed-case ("EmployeeTable")
const SQL_FIND_USER = `
  SELECT employeeid, email, name
  FROM "EmployeeTable"
  WHERE lower(email) = lower($1) OR lower(employeeid) = lower($1)
  LIMIT 1
`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!SECRET) throw new Error("RESET_TOKEN_SECRET is not set");

    const { identifier } = req.body || {};
    const id = String(identifier || "").trim();

    // Always return generic response (no user enumeration)
    const generic = {
      ok: true,
      message:
        "If an account exists for what you entered, we've sent a reset link. It will expire in ~15 minutes.",
    };

    if (!id) {
      if (DEBUG) console.log("[request-reset] No identifier provided");
      return res.status(200).json(generic);
    }

    // Lookup by email OR employeeid
    const { rows } = await pool.query(SQL_FIND_USER, [id]);
    const user = rows?.[0];

    if (DEBUG) {
      console.log("[request-reset] Lookup", {
        input: id,
        found: !!user,
        employeeid: user?.employeeid,
        email: user?.email ? "(redacted)" : null,
      });
    }

    if (user?.email) {
      // Build token + link
      const payload = { sub: user.employeeid, email: user.email, typ: "pwreset" };
      const token = jwt.sign(payload, SECRET, { expiresIn: `${TTL_MIN}m` });
      const link = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;

      const subject = "Reset your Agasthya HR password";
      const preheader = "Use this link to set a new password. It expires soon.";

      const html = `<!doctype html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f7f8;">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:0;">
              <!-- preheader (hidden) -->
              <div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
                ${escapeHtml(preheader)}
              </div>
              <div style="padding:24px 24px 0 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
                <h2 style="margin:0 0 8px 0;font-weight:700;">Reset your password</h2>
                <p style="margin:0 0 12px 0;">
                  Hello${user.name ? ` ${escapeHtml(user.name)}` : ""},
                </p>
                <p style="margin:0 0 16px 0;">
                  We received a request to reset your Agasthya HR password.
                </p>
                <p style="margin:0 0 24px 0;">
                  <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
                    Reset password
                  </a>
                </p>
                <p style="margin:0 0 8px 0;color:#444;">Or paste this link into your browser:</p>
                <p style="margin:0 0 16px 0;word-break:break-all;">
                  <a href="${link}" style="color:#0a66c2;text-decoration:underline;">${link}</a>
                </p>
                <p style="margin:0 0 0 0;color:#666;">
                  This link expires in ${TTL_MIN} minutes. If you didn't request this, you can ignore this email.
                </p>
              </div>
              <div style="padding:16px 24px 24px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#999;font-size:12px;border-top:1px solid #eee;margin-top:16px;">
                Sent by Agasthya HR
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      try {
        await sendMail({ to: user.email, subject, html });
        if (DEBUG) console.log("[request-reset] Email sent to:", user.email);
      } catch (e) {
        // Keep response generic; only log when DEBUG
        if (DEBUG) console.error("[request-reset] Graph sendMail failed:", e?.message || e);
      }
    } else if (DEBUG) {
      console.log("[request-reset] No matching user/email; nothing sent");
    }

    return res.status(200).json(generic);
  } catch (e) {
    if (DEBUG) console.error("[request-reset] Fatal:", e?.message || e);
    // Still keep response generic
    return res.status(200).json({
      ok: true,
      message:
        "If an account exists for what you entered, we've sent a reset link. It will expire in 15 minutes.",
    });
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
