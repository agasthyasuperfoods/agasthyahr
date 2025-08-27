// pages/api/assets.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// Pretty name for company (display only)
const companyDisplaySQL = `
CASE UPPER(COALESCE(a.company, ''))
  WHEN 'AGB' THEN 'Agasthya Global Brands'
  WHEN 'ANM' THEN 'Agasthya Nutro Mlik'
  WHEN 'ASF' THEN 'AGASTHYA SUPERFOODS'
  WHEN 'ASF-FACTORY' THEN 'Agasthya Superfoods Factory'
  WHEN 'ASF - FACTORY' THEN 'Agasthya Superfoods Factory'
  ELSE COALESCE(a.company, '')
END AS company_display
`;

const ALLOWED_SORT = new Set([
  "updated_at","purchased_on","assigned_date","asset_tag","serial_no","category","status","company",
]);

const nz = (x) => (x === "" || x == null ? null : x);
function toLimit(v, def=200){ const n = Number(v); return Number.isFinite(n)&&n>0&&n<=1000 ? n : def; }
function toPage(v){ const n = Number(v); return Number.isFinite(n)&&n>0 ? n : 1; }

// -------------------------
// Main handler
// -------------------------
export default async function handler(req, res) {
  try {
    const idParam = req.query?.id ?? req.body?.id;
    const id = idParam != null && idParam !== "" ? Number(idParam) : null;

    if (req.method === "GET") {
      if (id) return readOne(res, id);
      return listMany(req, res);
    }

    if (req.method === "POST") {
      return createOne(req, res);
    }

    if (req.method === "PUT") {
      if (!id) return res.status(400).json({ error: "Missing id (use ?id= or body.id)" });
      return updateOne(req, res, id);
    }

    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Missing id (use ?id= or body.id)" });
      return deleteOne(res, id);
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("assets API error:", e);
    res.status(500).json({ error: "Internal error" });
  }
}

// -------------------------
// GET /api/assets (list)
// GET /api/assets?id=123 (single)
// -------------------------
async function listMany(req, res) {
  const {
    search = "",
    category = "ALL",
    status = "ALL",
    company = "ALL",
    page = "1",
    limit = "200",
    sort_by = "updated_at",
    sort_dir = "DESC",
  } = req.query || {};

  const where = [];
  const params = [];
  const push = (sql, val) => { params.push(val); where.push(sql.replace("$?", `$${params.length}`)); };

  if (search) {
    const q = `%${String(search).trim()}%`;
    push(`(
      a.asset_tag ILIKE $? OR a.serial_no ILIKE $? OR a.brand ILIKE $? OR a.model ILIKE $? OR
      a.assigned_name ILIKE $? OR a.assigned_employeeid ILIKE $? OR a.company ILIKE $?
    )`, q);
    params.push(q, q, q, q, q, q); // we already pushed first q above
  }
  if (category && category !== "ALL") push(`a.category = $?`, category);
  if (status && status !== "ALL")   push(`a.status   = $?::asset_status`, status);
  if (company && company !== "ALL") push(`a.company  = $?`, company);

  const orderCol = ALLOWED_SORT.has(String(sort_by)) ? String(sort_by) : "updated_at";
  const orderDir = String(sort_dir).toUpperCase() === "ASC" ? "ASC" : "DESC";
  const lim = toLimit(limit);
  const off = (toPage(page) - 1) * lim;

  const sql = `
    SELECT
      a.*,
      ${companyDisplaySQL},
      s.email, s.installed_on, s.processor, s.operating_system,
      s.ram_text, s.disk_text, s.applications_installed, s.previously_used_by,
      COUNT(*) OVER() AS __total
    FROM "Assets" a
    LEFT JOIN "AssetSpecs" s ON s.asset_id = a.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${orderCol} ${orderDir}
    LIMIT ${lim} OFFSET ${off};
  `;

  const client = await pool.connect();
  try {
    const r = await client.query(sql, params);
    const total = r.rows[0]?.__total ? Number(r.rows[0].__total) : 0;
    const rows = r.rows.map(({ __total, ...rest }) => rest);
    res.status(200).json({ ok: true, total, rows });
  } catch (e) {
    console.error("GET /api/assets list error:", e);
    res.status(500).json({ error: "Failed to load assets" });
  } finally {
    client.release();
  }
}

async function readOne(res, id) {
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT a.*,
              ${companyDisplaySQL},
              s.email, s.installed_on, s.processor, s.operating_system,
              s.ram_text, s.disk_text, s.applications_installed, s.previously_used_by
         FROM "Assets" a
         LEFT JOIN "AssetSpecs" s ON s.asset_id = a.id
        WHERE a.id = $1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.status(200).json({ ok: true, asset: r.rows[0] });
  } catch (e) {
    console.error("GET /api/assets?id= error:", e);
    res.status(500).json({ error: "Failed to load asset" });
  } finally {
    client.release();
  }
}

// -------------------------
// POST /api/assets  (create)
// body: asset fields + (optional) specs
// -------------------------
async function createOne(req, res) {
  const {
    asset_tag, category, brand, model, serial_no, company, status,
    assigned_employeeid, assigned_name, assigned_date,
    vendor, purchased_on, warranty, location, remarks,

    // optional specs:
    email, installed_on, processor, operating_system, ram_text, disk_text,
    applications_installed, previously_used_by,
  } = req.body || {};

  if (!category) return res.status(400).json({ error: "category is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `INSERT INTO "Assets"
         (asset_tag, category, brand, model, serial_no, company, status,
          assigned_employeeid, assigned_name, assigned_date,
          vendor, purchased_on, warranty, location, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,
               COALESCE($7,'InStock')::asset_status,
               $8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        nz(asset_tag), category, nz(brand), nz(model), nz(serial_no), nz(company),
        nz(status),
        nz(assigned_employeeid), nz(assigned_name), nz(assigned_date),
        nz(vendor), nz(purchased_on), nz(warranty), nz(location), nz(remarks),
      ]
    );

    const id = ins.rows[0].id;

    if (
      email || installed_on || processor || operating_system ||
      ram_text || disk_text || applications_installed || previously_used_by
    ) {
      await client.query(
        `INSERT INTO "AssetSpecs"
          (asset_id, email, installed_on, processor, operating_system, ram_text, disk_text, applications_installed, previously_used_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (asset_id) DO UPDATE SET
           email = EXCLUDED.email,
           installed_on = EXCLUDED.installed_on,
           processor = EXCLUDED.processor,
           operating_system = EXCLUDED.operating_system,
           ram_text = EXCLUDED.ram_text,
           disk_text = EXCLUDED.disk_text,
           applications_installed = EXCLUDED.applications_installed,
           previously_used_by = EXCLUDED.previously_used_by`,
        [id, nz(email), nz(installed_on), nz(processor), nz(operating_system),
         nz(ram_text), nz(disk_text), nz(applications_installed), nz(previously_used_by)]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true, id });
  } catch (e) {
    await client.query("ROLLBACK");
    if (/Assets_.*_key/.test(String(e?.message))) {
      return res.status(409).json({ error: "Duplicate asset_tag or serial_no" });
    }
    console.error("POST /api/assets error:", e);
    res.status(500).json({ error: "Create failed" });
  } finally {
    client.release();
  }
}

// -------------------------
// PUT /api/assets?id=123  (update)
// body: any asset fields + optional specs (upserted)
// -------------------------
async function updateOne(req, res, id) {
  const {
    asset_tag, category, brand, model, serial_no, company, status,
    assigned_employeeid, assigned_name, assigned_date,
    vendor, purchased_on, warranty, location, remarks,

    // specs (optional)
    email, installed_on, processor, operating_system, ram_text, disk_text,
    applications_installed, previously_used_by,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Build dynamic SET
    const cols = [];
    const vals = [];
    const put = (col, val, cast = "") => {
      if (val === undefined) return;
      vals.push(val);
      const idx = `$${vals.length}`;
      cols.push(`${col} = ${cast ? `${idx}::${cast}` : idx}`);
    };

    put("asset_tag", nz(asset_tag));
    put("category", category);
    put("brand", nz(brand));
    put("model", nz(model));
    put("serial_no", nz(serial_no));
    put("company", nz(company));
    put("status", nz(status), "asset_status");
    put("assigned_employeeid", nz(assigned_employeeid));
    put("assigned_name", nz(assigned_name));
    put("assigned_date", nz(assigned_date));
    put("vendor", nz(vendor));
    put("purchased_on", nz(purchased_on));
    put("warranty", nz(warranty));
    put("location", nz(location));
    put("remarks", nz(remarks));
    cols.push(`updated_at = now()`);

    if (cols.length) {
      await client.query(
        `UPDATE "Assets" SET ${cols.join(", ")} WHERE id = $${vals.length + 1}`,
        [...vals, id]
      );
    }

    const anySpecs = [email, installed_on, processor, operating_system, ram_text, disk_text, applications_installed, previously_used_by]
      .some(v => v !== undefined);

    if (anySpecs) {
      await client.query(
        `INSERT INTO "AssetSpecs"
          (asset_id, email, installed_on, processor, operating_system, ram_text, disk_text, applications_installed, previously_used_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (asset_id) DO UPDATE SET
           email = EXCLUDED.email,
           installed_on = EXCLUDED.installed_on,
           processor = EXCLUDED.processor,
           operating_system = EXCLUDED.operating_system,
           ram_text = EXCLUDED.ram_text,
           disk_text = EXCLUDED.disk_text,
           applications_installed = EXCLUDED.applications_installed,
           previously_used_by = EXCLUDED.previously_used_by`,
        [id, nz(email), nz(installed_on), nz(processor), nz(operating_system),
         nz(ram_text), nz(disk_text), nz(applications_installed), nz(previously_used_by)]
      );
    }

    await client.query("COMMIT");

    const out = await client.query(
      `SELECT a.*, ${companyDisplaySQL},
              s.email, s.installed_on, s.processor, s.operating_system,
              s.ram_text, s.disk_text, s.applications_installed, s.previously_used_by
         FROM "Assets" a LEFT JOIN "AssetSpecs" s ON s.asset_id = a.id
        WHERE a.id = $1`,
      [id]
    );
    res.status(200).json({ ok: true, asset: out.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    if (/Assets_.*_key/.test(String(e?.message))) {
      return res.status(409).json({ error: "Duplicate asset_tag or serial_no" });
    }
    console.error("PUT /api/assets error:", e);
    res.status(500).json({ error: "Update failed" });
  } finally {
    client.release();
  }
}

// -------------------------
// DELETE /api/assets?id=123
// -------------------------
async function deleteOne(res, id) {
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM "Assets" WHERE id = $1`, [id]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/assets error:", e);
    res.status(500).json({ error: "Delete failed" });
  } finally {
    client.release();
  }
}
