import { IncomingForm } from "formidable";
import fs from "fs";
import { ConfidentialClientApplication } from "@azure/msal-node";
import fetch from "node-fetch";

export const config = { api: { bodyParser: false } };
const SITE_ID = process.env.SHAREPOINT_SITE_ID;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const form = new IncomingForm({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, message: "File upload error" });
    }
    let invoices = files.invoices;
    if (!Array.isArray(invoices)) invoices = invoices ? [invoices] : [];
    if (!invoices.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }
    try {
      const cca = new ConfidentialClientApplication({
        auth: {
          clientId: process.env.AZURE_CLIENT_ID,
          authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
          clientSecret: process.env.AZURE_CLIENT_SECRET,
        },
      });
      const tokenResponse = await cca.acquireTokenByClientCredential({
        scopes: ["https://graph.microsoft.com/.default"],
      });
      const accessToken = tokenResponse.accessToken;
      const fileUrls = [];
      for (const file of invoices) {
        const fileBuffer = fs.readFileSync(file.filepath);
        const fileName = file.originalFilename;
        const uploadRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/root:/${encodeURIComponent(fileName)}:/content`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": file.mimetype,
            },
            body: fileBuffer,
          }
        );
        const uploadBody = await uploadRes.text();
        if (!uploadRes.ok) {
          return res.status(500).json({ success: false, message: uploadBody });
        }
        const uploadJson = JSON.parse(uploadBody);
        // Create org-wide view link
        const shareRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/items/${uploadJson.id}/createLink`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ type: "view", scope: "organization" }),
          }
        );
        const shareBody = await shareRes.text();
        if (!shareRes.ok) {
          return res.status(500).json({ success: false, message: shareBody });
        }
        const shareJson = JSON.parse(shareBody);
        const url = shareJson?.link?.webUrl || uploadJson?.webUrl;
        fileUrls.push(url);
      }
      return res.status(200).json({ success: true, fileUrls });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message || "Upload failed" });
    }
  });
}
