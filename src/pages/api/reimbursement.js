import { IncomingForm } from "formidable";
import fs from "fs";
import { ConfidentialClientApplication } from "@azure/msal-node";
import fetch from "node-fetch";

// ====== Replace below with your real siteId from Graph Explorer ======
const SITE_ID = "your-sharepoint-site-id"; // e.g. "agasthyasuperfoodsindia.sharepoint.com,GUID,GUID"

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const form = new IncomingForm({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("File parse error:", err);
      return res.status(500).json({ success: false, message: "File upload error" });
    }

    let invoices = files.invoices;
    if (!Array.isArray(invoices)) invoices = invoices ? [invoices] : [];
    if (!invoices.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    try {
      // Authenticate with Microsoft Graph using client credentials
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
        console.log('Uploading:', fileName, 'Size:', fileBuffer.length, 'Type:', file.mimetype);

        // ===== Upload to SharePoint site root document library =====
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
          console.error("Upload failed:", uploadBody);
          return res.status(500).json({ success: false, message: uploadBody });
        }
        const uploadJson = JSON.parse(uploadBody);

        // ===== Create shareable link (organization scope recommended) =====
        const shareRes = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/items/${uploadJson.id}/createLink`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ type: "view", scope: "organization" }), // Use "anonymous" only if you want public links
          }
        );
        const shareBody = await shareRes.text();
        if (!shareRes.ok) {
          console.error("Share link error:", shareBody);
          return res.status(500).json({ success: false, message: shareBody });
        }
        const shareJson = JSON.parse(shareBody);
        const url = shareJson?.link?.webUrl || uploadJson?.webUrl;
        fileUrls.push(url);
      }

      return res.status(200).json({ success: true, fileUrls });

    } catch (e) {
      console.error("Upload error:", e);
      return res.status(500).json({ success: false, message: e.message || "Upload failed" });
    }
  });
}
