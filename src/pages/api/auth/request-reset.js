// /src/pages/api/auth/request-reset.js
import jwt from "jsonwebtoken";
import pool from "@/lib/db";
import { sendMail } from "@/lib/o365";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MINUTES || "15", 10);
const SECRET = process.env.RESET_TOKEN_SECRET;
const DEBUG = process.env.DEBUG_RESET === "1";

// IMPORTANT: If your table was created quoted as "EmployeeTable" (mixed case),
// you must keep the quotes below. If your table is all lowercase (employeetable),
// then change the SQL to use the correct name without quotes.
const SQL_FIND_USER = `
  SELECT employeeid, email, name
  FROM "EmployeeTable"
  WHERE lower(email) = lower($1) OR lower(employeeid) = lower($1)
  LIMIT 1
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    if (!SECRET) throw new Error("RESET_TOKEN_SECRET is not set");
    const { identifier } = req.body || {};
    const id = String(identifier || "").trim();

    // Always return same response shape even if missing input
    if (!id) {
      if (DEBUG) console.log("[request-reset] No identifier provided");
      return res.status(200).json({
        ok: true,
        message: "If an account exists for what you entered, we've sent a reset link. It will expire in ~15 minutes.",
      });
    }

    // 1) Lookup user by email OR employeeid in EmployeeTable
    const { rows } = await pool.query(SQL_FIND_USER, [id]);
    const user = rows?.[0];

    if (DEBUG) {
      console.log("[request-reset] Lookup:", {
        input: id,
        found: !!user,
        email: user?.email ? "(redacted)" : null,
        employeeid: user?.employeeid,
      });
    }

    // 2) If found (and has an email), build token + send email
    if (user?.email) {
      const payload = { sub: user.employeeid, email: user.email, typ: "pwreset" };
      const token = jwt.sign(payload, SECRET, { expiresIn: `${TTL_MIN}m` });
const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const subject = "Reset your Agasthya  password";
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
          <h2>Reset your password</h2>
          <p>Hello${user.name ? ` ${escapeHtml(user.name)}` : ""},</p>
          <p>We received a request to reset your Agasthya password. Click the button below:</p>
          <p>
            <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
              Reset password
            </a>
          </p>
          <p>Or paste this link into your browser:</p>
          <p style="word-break:break-all;"><a href="${link}">${link}</a></p>
          <p>This link expires in ${TTL_MIN} minutes. If you didn't request this, you can ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <p style="font-size:12px;color:#666;">Sent by Agasthya </p>
        </div>
      `;

      try {
        await sendMail({ to: user.email, subject, html });
        if (DEBUG) console.log("[request-reset] Email sent via Graph to:", user.email);
      } catch (e) {
        // Swallow errors to keep response generic, but log in DEBUG
        if (DEBUG) console.error("[request-reset] Graph sendMail failed:", e?.message || e);
      }
    } else if (DEBUG) {
      console.log("[request-reset] No matching user/email; nothing sent");
    }

    // 3) Always respond the same
    return res.status(200).json({
      ok: true,
      message: "If an account exists for what you entered, we've sent a reset link. It will expire in ~15 minutes.",
    });
  } catch (e) {
    if (DEBUG) console.error("[request-reset] Fatal:", e?.message || e);
    // Still avoid leaking info; keep the generic message
    return res.status(200).json({
      ok: true,
      message: "If an account exists for what you entered, we've sent a reset link. It will expire in ~15 minutes.",
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
