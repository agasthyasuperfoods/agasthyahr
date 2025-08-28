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
  const token = await getToken();

  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER_UPN)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html }, // <- force HTML
        toRecipients: [{ emailAddress: { address: to } }],
        from: { emailAddress: { address: MS_SENDER_UPN } },
      },
      saveToSentItems: false,
    }),
  });

  if (!r.ok) throw new Error(`Graph sendMail failed (${r.status}): ${await r.text()}`);
}
