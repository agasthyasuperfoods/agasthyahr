import pool from "@/lib/db";

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const m = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : null;
}

export default async function handler(req, res) {
  try {
    const cookieHeader = req.headers.cookie || "";
    const employeeid = readCookie(cookieHeader, "hr_employeeid"); // set at login
    const companyCookie = readCookie(cookieHeader, "hr_company"); // legacy/global cookie

    let dbUser = null;
    if (employeeid) {
      const { rows } = await pool.query(
        `SELECT employeeid, name, company
           FROM public."EmployeeTable"
          WHERE "employeeid" = $1
          LIMIT 1`,
        [employeeid]
      );
      if (rows.length) dbUser = rows[0];
    }

    // DB wins → else cookie → else ASF
    const rawCompany = dbUser?.company || companyCookie || "ASF";
    const companyFinal = String(rawCompany || "").trim();
    const nameFinal = dbUser?.name || "HR";

    // Set both legacy (global) and namespaced cookies so client can pick up
    const cookies = [
      `hr_company=${encodeURIComponent(companyFinal)}; Path=/; Max-Age=31536000; SameSite=Lax`,
    ];
    if (employeeid) {
      cookies.push(
        `hr_company_${encodeURIComponent(employeeid)}=${encodeURIComponent(companyFinal)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
    }
    res.setHeader("Set-Cookie", cookies);

    return res.status(200).json({
      employeeid: employeeid || null,
      name: nameFinal,
      company: companyFinal,
    });
  } catch (e) {
    // safe fallback
    return res.status(200).json({ employeeid: null, name: "HR", company: "ASF" });
  }
}
