import { neon } from "@neondatabase/serverless";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Fetch employees whose probation ends in exactly 7 days
    const upcoming = await sql`
      SELECT name, employeeid, probation_end_date, company
      FROM "EmployeeTable"
      WHERE probation_status ILIKE 'under_probation'
      AND probation_end_date::date = (CURRENT_DATE + interval '7 days')::date
    `;

    if (upcoming.length === 0) {
      return res.status(200).json({ message: "No probation alerts for today." });
    }

    // 2. Setup SMTP Transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: "wecare.anm@agasthya.co.in",
        pass: "rxnlxctqbcgygqvw", // Use environment variables for sensitive data
      },
    });

    // 3. Loop through employees and send email
    for (const emp of upcoming) {
      const formattedDate = new Date(emp.probation_end_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const mailOptions = {
        from: '"Agasthya HRMS" <wecare.anm@agasthya.co.in>',
        to: "hr.ho@agasthya.co.in",
        subject: `Probation End Alert: ${emp.name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="color-scheme" content="light">
            <meta name="supported-color-schemes" content="light">
            <title>Probation End Alert</title>
            <style>
              [data-ogsc] .card { background-color: #ffffff !important; }
              [data-ogsc] .text-color { color: #1a202c !important; }
              [data-ogsc] .bg-white { background-color: #ffffff !important; }
              [data-ogsb] .card { background-color: #ffffff !important; }
              [data-ogsb] .text-color { color: #1a202c !important; }
              [data-ogsb] .bg-white { background-color: #ffffff !important; }
            </style>
          </head>
          <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: sans-serif;">
            <center style="width: 100%; background-color: #ffffff;" class="bg-white">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin: 0 auto;" bgcolor="#ffffff" class="bg-white">
                
                <tr bgcolor="#ffffff">
                  <td align="center" style="padding: 40px 0;" bgcolor="#ffffff">
                    <img src="https://agasthyahr.vercel.app/agasthyalogo.png" width="200" alt="Agasthya Logo" style="display: block;">
                  </td>
                </tr>
                
                <tr bgcolor="#ffffff">
                  <td bgcolor="#ffffff" class="card">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;" bgcolor="#ffffff" class="card">
                      <tr bgcolor="#c53030">
                        <td height="6" style="background-color: #c53030;"></td>
                      </tr>
                      <tr bgcolor="#ffffff">
                        <td style="padding: 40px;" bgcolor="#ffffff">
                          <h1 style="font-size: 24px; font-weight: bold; color: #1a202c !important; margin: 0 0 20px;" class="text-color">Probation Period Ending Soon</h1>
                          <p style="font-size: 16px; color: #1a202c !important; margin: 0 0 30px;" class="text-color">This is a notification that the probation period for the following employee is ending in 7 days.</p>
                          
                          <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff">
                            <tr bgcolor="#ffffff">
                              <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;" bgcolor="#ffffff">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff">
                                  <tr bgcolor="#ffffff">
                                    <td width="150" style="font-size: 14px; font-weight: bold; color: #1a202c !important;" class="text-color">Name:</td>
                                    <td style="font-size: 15px; color: #1a202c !important;" class="text-color">${emp.name}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr bgcolor="#ffffff">
                              <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;" bgcolor="#ffffff">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff">
                                  <tr bgcolor="#ffffff">
                                    <td width="150" style="font-size: 14px; font-weight: bold; color: #1a202c !important;" class="text-color">Employee ID:</td>
                                    <td style="font-size: 15px; color: #1a202c !important;" class="text-color">${emp.employeeid}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                            <tr bgcolor="#ffffff">
                              <td style="padding: 15px 0;" bgcolor="#ffffff">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff">
                                  <tr bgcolor="#ffffff">
                                    <td width="150" style="font-size: 14px; font-weight: bold; color: #1a202c !important;" class="text-color">Probation End Date:</td>
                                    <td style="font-size: 15px; color: #1a202c !important;" class="text-color">${formattedDate}</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          
                          
                          
                          <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" bgcolor="#ffffff" style="margin-top: 30px;">
                            <tr bgcolor="#ffffff">
                              <td align="center" bgcolor="#ffffff">
                                <table border="0" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#ffffff">
                                  <tr bgcolor="#ffffff">
                                    <td align="center" bgcolor="#c53030" style="border-radius: 10px;">
                                      <a href="https://agasthyahr.vercel.app/Hlogin" target="_blank" style="font-size: 16px; font-weight: bold; color: #ffffff !important; text-decoration: none; display: inline-block; padding: 14px 28px; border-radius: 10px;">Go to HR Dashboard</a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr bgcolor="#ffffff">
                  <td align="center" style="padding: 40px 0 20px; font-size: 12px; color: #64748b; font-family: sans-serif;" bgcolor="#ffffff">
                    &copy; ${new Date().getFullYear()} Agasthya Superfoods Pvt. Ltd. All rights reserved.
                  </td>
                </tr>
              </table>
            </center>
          </body>
          </html>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    return res.status(200).json({
      success: true,
      message: `Sent ${upcoming.length} probation alert(s) successfully.`,
    });

  } catch (error) {
    console.error("Cron Job Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      details: error.message,
    });
  }
}
