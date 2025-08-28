// /src/lib/o365.js
const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const SENDER_UPN = process.env.MS_SENDER_UPN; // e.g. no-reply@agasthya.co.in

async function getGraphToken() {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET");
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: "https://graph.microsoft.com/.default",
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token request failed: ${res.status} ${t}`);
  }
  const j = await res.json();
  return j.access_token;
}

/**
 * Send an HTML email via Microsoft Graph (application permissions).
 * @param {Object} opts
 * @param {string|string[]} opts.to - One or more recipient addresses.
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.from=SENDER_UPN] - Must be the mailbox allowed by your App Access Policy.
 * @param {string} [opts.replyTo]
 */
export async function sendMail({ to, subject, html, from = SENDER_UPN, replyTo } = {}) {
  if (!from) throw new Error("MS_SENDER_UPN not set");
  if (!to || !subject || !html) throw new Error("to, subject, html are required");

  const token = await getGraphToken();

  const toList = Array.isArray(to) ? to : String(to).split(",").map(s => s.trim()).filter(Boolean);
  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: toList.map(addr => ({ emailAddress: { address: addr } })),
  };
  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo } }];
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        saveToSentItems: false,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph sendMail failed: ${res.status} ${text}`);
  }
  return true;
}

// Back-compat alias if other files tried to import a different name
export const sendMailO365 = sendMail;
