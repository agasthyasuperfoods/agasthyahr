import { neon } from "@neondatabase/serverless";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Fetch employees with flexible case matching
    // Matches "UNDER_PROBATION", "under_probation", or "Under_Probation"
    const upcoming = await sql`
      SELECT name, employeeid, probation_end_date, company
      FROM "EmployeeTable"
      WHERE probation_status ILIKE 'under_probation'
      AND probation_end_date::date = (CURRENT_DATE + interval '7 days')::date
    `;

    if (upcoming.length === 0) {
      return res.status(200).json({ message: "No alerts for today." });
    }

    // 2. SMTP Transporter using Outlook/Office 365
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // Must be false for port 587 (STARTTLS)
      auth: {
        user: "jaswanth.nallapareddy@agasthya.co.in", 
        pass: process.env.OUTLOOK_APP_PASSWORD, // We will populate this later
      },
    });

    // 3. Loop through and send an email for each alert found
    for (const emp of upcoming) {
      await transporter.sendMail({
        from: '"Agasthya HR System" <jaswanth.nallapareddy@agasthya.co.in>',
        to: "njsr2005@gmail.com",
        subject: `Probation End Alert: ${emp.name}`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.6;">
            <h2 style="color: #d9534f;">Probation Period Alert</h2>
            <p>This is an automated notification that the probation period for 
               <b>${emp.name}</b> (${emp.employeeid}) is scheduled to end on 
               <b>${emp.probation_end_date}</b>.</p>
            <p><b>Company:</b> ${emp.company}</p>
            <hr />
            <p style="font-size: 0.8em; color: #777;">Sent automatically by HRMS</p>
          </div>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Sent ${upcoming.length} alerts successfully.`,
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
}