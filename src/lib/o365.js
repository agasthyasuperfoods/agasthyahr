// /src/lib/o365.js
const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_SENDER_UPN,
} = process.env;

async function getToken() {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Token ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.access_token;
}

export async function sendMail({ to, subject, html }) {
  if (!MS_SENDER_UPN) throw new Error("MS_SENDER_UPN not set");
  if (!to || !subject || !html) throw new Error("sendMail requires to, subject, html");

  const token = await getToken();
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER_UPN)}/sendMail`;

  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html }, // HTML ensures clickable links/buttons
      toRecipients: [{ emailAddress: { address: to } }],
      // no `from` here — Graph sets it to MS_SENDER_UPN
    },
    saveToSentItems: false, // boolean is fine
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) throw new Error(`Graph sendMail failed (${r.status}): ${await r.text()}`);
}
