// /pages/api/assets/Aindex.js
// End-to-end API hardening + full support for SIM/Mobile/Vehicle/Specs columns.
// - Persists extras to dedicated columns (no more stuffing into remarks)
// - Enforces Asset Tag + Company mandatory on CREATE; validates on UPDATE
// - Duplicate tag prevention on CREATE and UPDATE (409 Conflict)
// - Implements DELETE by id; also supports PUT { action: "delete", ids: [...] }
// - GET supports by id and list filters; returns all relevant columns

import pool from "@/lib/db";

// Columns that actually exist in public."Assets"
const SELECT_COLS = [
  "id",
  "asset_tag",
  "category",
  "brand",
  "model",
  "serial_no",
  "company",
  "status",
  "assigned_employeeid",
  "assigned_name",
  "assigned_date",
  "location",
  "vendor",
  "purchased_on",
  "warranty",
  "remarks",
  // --- extras: SIM
  "sim_provider",
  "sim_number",
  "sim_iccid",
  "sim_plan",
  "sim_valid_till",
  // --- extras: Mobile
  "mob_phone",
  "mob_imei1",
  "mob_imei2",
  "mob_os",
  // --- extras: Vehicle
  "veh_reg",
  "veh_type",
  "veh_fuel",
  "veh_insurance_till",
  // --- extras: Hardware specs
  "email",
  "installed_on",
  "processor",
  "operating_system",
  "ram_text",
  "disk_text",
  "applications_installed",
  "previously_used_by",
  // meta
  "updated_at",
];

// Only allow updating/inserting these
const ALLOWED_FIELDS = new Set([
  "asset_tag",
  "category",
  "brand",
  "model",
  "serial_no",
  "company",
  "status",
  "assigned_employeeid",
  "assigned_name",
  "assigned_date",
  "location",
  "vendor",
  "purchased_on",
  "warranty",
  "remarks",

  // extras: SIM
  "sim_provider",
  "sim_number",
  "sim_iccid",
  "sim_plan",
  "sim_valid_till",

  // extras: Mobile
  "mob_phone",
  "mob_imei1",
  "mob_imei2",
  "mob_os",

  // extras: Vehicle
  "veh_reg",
  "veh_type",
  "veh_fuel",
  "veh_insurance_till",

  // extras: Hardware specs
  "email",
  "installed_on",
  "processor",
  "operating_system",
  "ram_text",
  "disk_text",
  "applications_installed",
  "previously_used_by",
]);

function pickProvidedUpdatable(body = {}) {
  return Object.fromEntries(
    Object.entries(body)
      .filter(([k, v]) => ALLOWED_FIELDS.has(k))
      .map(([k, v]) => [k, v === "" ? null : v]) // normalize "" -> null
  );
}

const normTag = (t) => String(t ?? "").trim();
const normStr = (s) => String(s ?? "").trim();

async function tagExists(tag, excludeId = null) {
  const params = [normTag(tag)];
  let sql = `SELECT id FROM public."Assets" WHERE LOWER("asset_tag") = LOWER($1)`;
  if (excludeId) {
    params.push(Number(excludeId));
    sql += ` AND id <> $2`;
  }
  sql += ` LIMIT 1`;
  const { rows } = await pool.query(sql, params);
  return rows.length > 0 ? rows[0].id : null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      // GET single by id
      if (req.query?.id) {
        const id = Number(req.query.id);
        if (!id) return res.status(400).json({ error: "invalid id" });
        const q = `
          SELECT ${SELECT_COLS.map((c) => `"${c}"`).join(", ")}
          FROM public."Assets"
          WHERE id = $1
          LIMIT 1
        `;
        const { rows } = await pool.query(q, [id]);
        if (!rows.length) return res.status(404).json({ error: "Not found" });
        return res.status(200).json({ asset: rows[0] });
      }

      // GET list with optional filters
      const { assigned_employeeid, asset_tag, serial_no, status, category, company } = req.query || {};
      const where = [];
      const params = [];

      if (assigned_employeeid) {
        params.push(normStr(assigned_employeeid));
        where.push(`"assigned_employeeid" = $${params.length}`);
      }
      if (asset_tag) {
        params.push(normStr(asset_tag).toLowerCase());
        where.push(`LOWER("asset_tag") = $${params.length}`);
      }
      if (serial_no) {
        params.push(normStr(serial_no).toLowerCase());
        where.push(`LOWER("serial_no") = $${params.length}`);
      }
      if (status) {
        params.push(normStr(status));
        where.push(`"status" = $${params.length}`);
      }
      if (category) {
        params.push(normStr(category));
        where.push(`"category" = $${params.length}`);
      }
      if (company) {
        params.push(normStr(company));
        where.push(`"company" = $${params.length}`);
      }

      const q = `
        SELECT ${SELECT_COLS.map((c) => `"${c}"`).join(", ")}
        FROM public."Assets"
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY id ASC
      `;
      const { rows } = await pool.query(q, params);
      return res.status(200).json({ rows, data: rows });
    } catch (e) {
      console.error("GET /api/assets/Aindex failed:", e);
      return res.status(500).json({ error: "Failed to load assets" });
    }
  }

  if (req.method === "POST") {
    try {
      const data = pickProvidedUpdatable(req.body || {});
      const requiredTag = normTag(data.asset_tag);
      const requiredCompany = normStr(data.company);

      if (!requiredTag) return res.status(400).json({ error: "Asset Tag is mandatory" });
      if (!requiredCompany) return res.status(400).json({ error: "Company is mandatory" });

      // duplicate tag check
      const dup = await tagExists(requiredTag);
      if (dup) return res.status(409).json({ error: `Asset Tag "${requiredTag}" already exists` });

      // default category if missing
      if (!data.category) data.category = "Other";

      // Build insert
      const cols = Object.keys(data);
      const vals = Object.values(data);
      const placeholders = cols.map((_, i) => `$${i + 1}`);

      const q = `
        INSERT INTO public."Assets" (${cols.map((c) => `"${c}"`).join(", ")})
        VALUES (${placeholders.join(", ")})
        RETURNING ${SELECT_COLS.map((c) => `"${c}"`).join(", ")}
      `;
      const { rows } = await pool.query(q, vals);
      const row = rows[0];
      return res.status(201).json({ id: row.id, asset: row, row });
    } catch (e) {
      console.error("POST /api/assets/Aindex failed:", e);
      return res.status(500).json({ error: "Failed to create asset" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { action } = req.body || {};

      // --- bulk delete fallback ---
      if (action === "delete") {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        if (!ids.length) return res.status(400).json({ error: "ids required" });
        const params = [];
        const inSql = ids.map((id) => {
          params.push(Number(id));
          return `$${params.length}`;
        });
        const q = `
          DELETE FROM public."Assets"
          WHERE id IN (${inSql.join(", ")})
          RETURNING id
        `;
        const result = await pool.query(q, params);
        return res.status(200).json({ deleted: result.rowCount, ids: result.rows.map((r) => r.id) });
      }

      // --- offboarding helpers (unchanged behavior) ---
      if (action === "offboard") {
        const assetIds = Array.isArray(req.body?.assetIds) ? req.body.assetIds : [];
        if (!assetIds.length) return res.status(400).json({ error: "assetIds required" });

        const params = [];
        const idsIn = assetIds.map((id) => {
          params.push(Number(id));
          return `$${params.length}`;
        });
        const q = `
          UPDATE public."Assets"
          SET assigned_employeeid = NULL,
              assigned_name = NULL,
              assigned_date = NULL,
              status = 'InStock',
              updated_at = NOW()
          WHERE id IN (${idsIn.join(", ")})
          RETURNING id
        `;
        const result = await pool.query(q, params);
        return res.status(200).json({ updated: result.rowCount, ids: result.rows.map((r) => r.id) });
      }

      if (action === "offboardAllForEmployee") {
        const employeeid = normStr(req.body?.employeeid);
        if (!employeeid) return res.status(400).json({ error: "employeeid required" });

        const q = `
          UPDATE public."Assets"
          SET assigned_employeeid = NULL,
              assigned_name = NULL,
              assigned_date = NULL,
              status = 'InStock',
              updated_at = NOW()
          WHERE "assigned_employeeid" = $1
          RETURNING id
        `;
        const result = await pool.query(q, [employeeid]);
        return res.status(200).json({ updated: result.rowCount, ids: result.rows.map((r) => r.id) });
      }

      // --- generic full update ---
      const id = Number(req.body?.id);
      if (!id) return res.status(400).json({ error: "id is required" });

      const data = pickProvidedUpdatable(req.body || {});
      if (!Object.keys(data).length) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      // Validate required fields if provided
      if ("asset_tag" in data) {
        const t = normTag(data.asset_tag);
        if (!t) return res.status(400).json({ error: "Asset Tag is mandatory" });
        const dup = await tagExists(t, id);
        if (dup) return res.status(409).json({ error: `Asset Tag "${t}" already exists` });
        data.asset_tag = t;
      }
      if ("company" in data) {
        const c = normStr(data.company);
        if (!c) return res.status(400).json({ error: "Company is mandatory" });
        data.company = c;
      }

      const sets = [];
      const vals = [];
      let idx = 1;

      for (const [k, v] of Object.entries(data)) {
        sets.push(`"${k}" = $${idx++}`);
        vals.push(v);
      }
      sets.push(`"updated_at" = NOW()`);
      vals.push(id);

      const q = `
        UPDATE public."Assets"
        SET ${sets.join(", ")}
        WHERE id = $${idx}
        RETURNING ${SELECT_COLS.map((c) => `"${c}"`).join(", ")}
      `;
      const result = await pool.query(q, vals);
      if (result.rowCount === 0) return res.status(404).json({ error: "Asset not found" });

      const row = result.rows[0];
      return res.status(200).json({ row, asset: row, data: row });
    } catch (e) {
      console.error("PUT /api/assets/Aindex failed:", e);
      return res.status(500).json({ error: "Failed to update assets" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = Number(req.query?.id);
      if (!id) return res.status(400).json({ error: "id is required" });

      const q = `DELETE FROM public."Assets" WHERE id = $1 RETURNING id`;
      const result = await pool.query(q, [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: "Asset not found" });

      return res.status(200).json({ id });
    } catch (e) {
      console.error("DELETE /api/assets/Aindex failed:", e);
      return res.status(500).json({ error: "Failed to delete asset" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
