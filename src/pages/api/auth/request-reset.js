// /src/pages/api/auth/request-reset.js
import jwt from "jsonwebtoken";
import pool from "@/lib/db";
import { sendMail } from "@/lib/o365";

const BASE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MINUTES || "15", 10);
const SECRET = process.env.RESET_TOKEN_SECRET;
const DEBUG = process.env.DEBUG_RESET === "1";

const SQL_FIND_EMP = `
  SELECT employeeid, email, name
  FROM "EmployeeTable"
  WHERE lower(email) = lower($1) OR lower(employeeid) = lower($1)
  LIMIT 1
`;

const SQL_FIND_ADMIN = `
  SELECT employeeid, email, name
  FROM public.admin
  WHERE lower(email) = lower($1) OR lower(employeeid) = lower($1)
  LIMIT 1
`;

function normalizeToPath(toParam) {
  const ALLOWED = new Set(["/Alogin", "/Hlogin"]);
  if (!toParam) return "/Hlogin";
  let s = String(toParam).trim();
  if (!s.startsWith("/")) s = `/${s}`;
  return ALLOWED.has(s) ? s : "/Hlogin";
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const generic = {
    ok: true,
    message: "If an account exists for what you entered, we've sent a reset link. It will expire in ~15 minutes.",
  };

  try {
    if (!SECRET) throw new Error("RESET_TOKEN_SECRET is not set");

    const { identifier, to } = req.body || {};
    const id = String(identifier || "").trim();
    const toPath = normalizeToPath(to);
    const audience = toPath === "/Alogin" ? "admin" : "employee";

    if (!id) {
      if (DEBUG) console.log("[request-reset] No identifier provided");
      return res.status(200).json(generic);
    }

    // Pick table based on where the reset was initiated from
    const sql = audience === "admin" ? SQL_FIND_ADMIN : SQL_FIND_EMP;
    const { rows } = await pool.query(sql, [id]);
    const user = rows?.[0];

    if (DEBUG) {
      console.log("[request-reset] Lookup", {
        audience,
        input: id,
        found: !!user,
        employeeid: user?.employeeid,
        email: user?.email ? "(redacted)" : null,
      });
    }

    if (user?.email) {
      // Build token – include audience so complete endpoint knows which table to update
      const payload = { sub: user.employeeid || id, email: user.email, typ: "pwreset", aud: audience };
      const token = jwt.sign(payload, SECRET, { expiresIn: `${TTL_MIN}m` });
      const link = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}&to=${encodeURIComponent(toPath)}`;

      const subject = "Reset your Agasthya password";
      const html = `
<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f7f7f8;margin:0;padding:24px;">
  <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="padding:24px;color:#111;">
      <h2 style="margin:0 0 8px 0;font-weight:700;">Reset your password</h2>
      <p style="margin:0 0 12px 0;">Hello${user.name ? ` ${escapeHtml(user.name)}` : ""},</p>
      <p style="margin:0 0 16px 0;">We received a request to reset your Agasthya password.</p>
      <p style="margin:0 0 24px 0;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Reset password</a>
      </p>
      <p style="margin:0 0 8px 0;color:#444;">Or paste this link into your browser:</p>
      <p style="margin:0 0 16px 0;word-break:break-all;">
        <a href="${escapeHtml(link)}" style="color:#0a66c2;text-decoration:underline;">${escapeHtml(link)}</a>
      </p>
      <p style="margin:0;color:#666;">This link expires in ${TTL_MIN} minutes.</p>
    </div>
  </div>
</body></html>`.trim();

      try {
        await sendMail({ to: user.email, subject, html });
        if (DEBUG) console.log("[request-reset] Email sent to:", user.email);
      } catch (e) {
        if (DEBUG) console.error("[request-reset] sendMail error:", e?.message || e);
      }
    } else if (DEBUG) {
      console.log("[request-reset] No matching user/email; nothing sent");
    }

    return res.status(200).json(generic);
  } catch (e) {
    if (DEBUG) console.error("[request-reset] Fatal:", e?.message || e);
    return res.status(200).json(generic);
  }
}
