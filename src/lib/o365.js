// /src/lib/o365.js
const {
  MS_TENANT_ID,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_SENDER_UPN,
} = process.env;

function assertEnv() {
  const missing = [];
  if (!MS_TENANT_ID) missing.push("MS_TENANT_ID");
  if (!MS_CLIENT_ID) missing.push("MS_CLIENT_ID");
  if (!MS_CLIENT_SECRET) missing.push("MS_CLIENT_SECRET");
  if (!MS_SENDER_UPN) missing.push("MS_SENDER_UPN");
  if (missing.length) {
    throw new Error(`Missing env for O365 mail: ${missing.join(", ")}`);
  }
}

async function getAppToken() {
  assertEnv();
  const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OAuth token failed: ${res.status} ${err}`);
  }
  return res.json(); // { access_token, token_type, expires_in, ... }
}

export async function sendMail({ to, subject, html, text }) {
  assertEnv();
  if (!to) throw new Error("sendMail: 'to' is required");

  const { access_token } = await getAppToken();

  const body = {
    message: {
      subject: subject || "",
      body: {
        contentType: html ? "HTML" : "Text",
        content: html || text || "",
      },
      toRecipients: [{ emailAddress: { address: to } }],
      from: { emailAddress: { address: MS_SENDER_UPN } },
    },
    saveToSentItems: "false",
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER_UPN)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Graph sendMail failed: ${res.status} ${err}`);
  }
}
