// /pages/api/auth/reset/request.js
import jwt from "jsonwebtoken";
import { query } from "@/lib/db";
import { sendMailO365 } from "@/lib/o365";

const APP_URL = process.env.APP_URL;
const SECRET = process.env.RESET_TOKEN_SECRET;
const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MINUTES || "15", 10);

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email } = req.body || {};
    const em = String(email || "").trim().toLowerCase();
    if (!isEmail(em)) return res.status(400).json({ error: "Valid email is required" });

    // Look up the user by email (adjust table/column names if needed)
    // Expecting a `users` table with columns: id (uuid/int), email (unique)
    const { rows } = await query(`SELECT id, email, name FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [em]);
    // Always respond 200 to avoid user enumeration. Only send mail if found.
    if (rows.length) {
      const user = rows[0];
      const token = jwt.sign(
        { t: "pwd_reset", uid: String(user.id), email: user.email },
        SECRET,
        { expiresIn: `${TTL_MIN}m` }
      );
      const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
          <h2>Reset your Agasthya HR password</h2>
          <p>We received a request to reset the password for <strong>${user.email}</strong>.</p>
          <p>This link expires in <strong>${TTL_MIN} minutes</strong>:</p>
          <p>
            <a href="${link}" style="background:#C1272D;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block;">
              Set a new password
            </a>
          </p>
          <p>If you didn’t request this, you can ignore this email.</p>
        </div>
      `;
      try {
        await sendMailO365({
          to: user.email,
          subject: "Reset your Agasthya HR password",
          html,
        });
      } catch (e) {
        // Don't reveal mailing errors to caller
        console.error("sendMail error:", e);
      }
    }

    return res.status(200).json({ ok: true }); // generic response
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
