// /src/lib/o365.js
const TENANT = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const SENDER_UPN = process.env.MS_SENDER_UPN;

async function getToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OAuth token failed (${res.status}) ${await res.text()}`);
  const j = await res.json();
  return j.access_token;
}

export async function sendMail({ to, subject, html, from }) {
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !SENDER_UPN) {
    throw new Error("Missing O365 env (MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET / MS_SENDER_UPN)");
  }
  const accessToken = await getToken();
  const payload = {
    message: {
      subject: subject || "(no subject)",
      body: { contentType: "HTML", content: html || "" },
      from: { emailAddress: { address: from || SENDER_UPN } },
      sender: { emailAddress: { address: from || SENDER_UPN } },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: false,
  };

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_UPN)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph sendMail failed (${res.status}): ${text}`);
  }
  return true;
}
