// /pages/Assets.js
// UI hardened + extras saved to dedicated columns (not stuffed into remarks)
// - Asset Tag (*) and Company are mandatory (Create + Edit)
// - Duplicate tag guard on Create; one-click "Open Edit" if duplicate
// - Edit pre-fills all fields (incl. SIM/Mobile/Vehicle/Specs) and saves them into dedicated fields
// - Asset cards conditionally show relevant extras (SIM/Mobile/Vehicle/Specs)
// - Delete button disabled when missing id; clear user feedback
// - mapCompany typo fixed (Agasthya Nutro Milk)
// - Header wired: hrName, openProfile (modal), logout

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AppHeader from "@/components/AppHeader";
import ProfileModal from "@/components/ProfileModal";
import {
  Laptop, Monitor, Mouse, Printer, Tv2, HardDrive, Network,
  Wrench, CheckCircle2, Archive, Plus, RefreshCw, Search, X,
  Building2, Factory, Smartphone, Car, Trash2, Pencil
} from "lucide-react";
import Swal from "sweetalert2";

/* ---------- header helpers ---------- */
function getAuthIdentity() {
  if (typeof window === "undefined") return { id: null, email: null };
  const ls = window.localStorage;
  return {
    id: ls.getItem("hr_employeeid") || null,
    email: ls.getItem("hr_email") || null,
  };
}

/* ---------- constants ---------- */
const CATEGORY_OPTIONS = [
  "Laptop",
  "Desktop",
  "Mouse",
  "Printer",
  "TV",
  "Screen",
  "Switch",
  "SIM",
  "Mobile",
  "Motor Vehicle",
  "Other",
];
const STATUS_OPTIONS = ["InStock", "Assigned", "Repair", "Retired"];

/* ---------- helpers ---------- */
const mapCompany = (raw) => {
  const s = String(raw ?? "").trim();
  const n = s.toUpperCase();
  if (n === "AGB") return "Agasthya Global Brands";
  if (n === "ANM") return "Agasthya Nutro Milk"; // fixed typo
  if (n === "ASF") return "AGASTHYA SUPERFOODS";
  if (n === "ASF-FACTORY" || n === "ASF - FACTORY") return "Agasthya Superfoods Factory";
  return s || "—";
};
const toHuman = (d) => {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString();
};
const safe = (v) => (String(v ?? "").trim() || "—");

const isHardwareCategory = (c) => /^(laptop|desktop|screen|switch|printer|mouse|tv)$/i.test(String(c));
const isSIM = (c) => /^sim$/i.test(String(c));
const isMobile = (c) => /^mobile$/i.test(String(c));
const isVehicle = (c) => /^(motor vehicle|vehicle|car|bike)$/i.test(String(c));

/* ---------- category icon ---------- */
const CatIcon = ({ category, className = "h-5 w-5" }) => {
  const c = String(category || "").toLowerCase();
  const props = { className };
  if (c === "laptop") return <Laptop {...props} />;
  if (c === "desktop") return <Monitor {...props} />;
  if (c === "mouse") return <Mouse {...props} />;
  if (c === "printer") return <Printer {...props} />;
  if (c === "tv") return <Tv2 {...props} />;
  if (c === "switch") return <Network {...props} />;
  if (c === "screen" || c === "monitor") return <Monitor {...props} />;
  if (c === "mobile") return <Smartphone {...props} />;
  if (c === "motor vehicle" || c === "vehicle" || c === "car" || c === "bike") return <Car {...props} />;
  return <HardDrive {...props} />;
};

/* ---------- status chip ---------- */
const StatusPill = ({ s, className = "" }) => {
  const v = String(s || "InStock").toLowerCase();
  let cls = "bg-slate-100 text-slate-800 ";
  let Icon = Archive;
  let label = s || "InStock";
  if (v === "instock") { cls = "bg-slate-100 text-slate-800 "; Icon = Archive; label = "In Stock"; }
  else if (v === "assigned") { cls = "bg-emerald-50 text-emerald-700 "; Icon = CheckCircle2; }
  else if (v === "repair" || v === "service") { cls = "bg-amber-50 text-amber-800 "; Icon = Wrench; label = "Repair/Service"; }
  else if (v === "retired") { cls = "bg-gray-100 text-gray-700 "; Icon = Archive; }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap flex-none ${cls} ${className}`}>
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
};

/* ---------- KPI card ---------- */
function Kpi({ label, value, tone = "indigo" }) {
  const tones = {
    indigo: "from-indigo-50 to-white border-indigo-100",
    emerald: "from-emerald-50 to-white border-emerald-100",
    amber: "from-amber-50 to-white border-amber-100",
    slate: "from-slate-50 to-white border-slate-100",
  };
  return (
    <div className={`rounded-xl border ${tones[tone]} p-4 md:p-5 shadow-sm`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

/* ---------- small row ---------- */
function Row({ label, children, icon = null }) {
  return (
    <div className="flex gap-1.5 min-w-0">
      {icon ? <span className="text-gray-400 mt-0.5">{icon}</span> : null}
      <span className="text-gray-500">{label}:</span>
      <span className="text-gray-800 truncate">{children}</span>
    </div>
  );
}

/* ---------- asset card ---------- */
function AssetCard({ row, onEdit, onDelete }) {
  const {
    asset_tag, category, brand, model, serial_no, company, status,
    assigned_employeeid, assigned_name, assigned_date,
    vendor, purchased_on, warranty, location, remarks, updated_at,

    // Extras saved in dedicated columns
    sim_provider, sim_number, sim_iccid, sim_plan, sim_valid_till,
    mob_phone, mob_imei1, mob_imei2, mob_os,
    veh_reg, veh_type, veh_fuel, veh_insurance_till,
    email, installed_on, processor, operating_system, ram_text, disk_text, applications_installed, previously_used_by,
  } = row;

  const isApple = /apple|mac/i.test(String(brand) + " " + String(model));
  const canDelete = Boolean(row?.id);

  return (
    <div className="bg-white/80 border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="shrink-0 relative">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center">
            <CatIcon category={category} className="h-5 w-5 text-gray-700" />
          </div>
          {isApple && (
            <span className="absolute -top-1 -right-1 text-[10px] leading-none rounded-full px-1 py-0.5 bg-black text-white"></span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {asset_tag || "(no tag)"}
              </div>
              <div className="text-xs text-gray-600 whitespace-normal break-words leading-snug pr-2">
                {brand ? `${brand} • ${model || "-"}` : (model || "-")}
              </div>
            </div>
            <StatusPill s={status} className="shrink-0" />
          </div>

          {/* Core rows */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Row label="Company" icon={<Building2 className="h-3.5 w-3.5" />}>{mapCompany(company)}</Row>
            <Row label="Serial" icon={<HardDrive className="h-3.5 w-3.5" />}>{safe(serial_no)}</Row>
            <Row label="Assigned To">
              {assigned_name ? `${assigned_name} ${assigned_employeeid ? `(#${assigned_employeeid})` : ""}` : "—"}
            </Row>
            <Row label="Assigned On">{toHuman(assigned_date)}</Row>
            <Row label="Vendor">{safe(vendor)}</Row>
            <Row label="Purchased">{toHuman(purchased_on)}</Row>
            <Row label="Warranty">{safe(warranty)}</Row>
            <Row label="Location" icon={<Factory className="h-3.5 w-3.5" />}>{safe(location)}</Row>
          </div>

          {/* Extras sections */}
          {isSIM(category) && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Row label="SIM Provider">{safe(sim_provider)}</Row>
              <Row label="Phone No">{safe(sim_number)}</Row>
              <Row label="ICCID">{safe(sim_iccid)}</Row>
              <Row label="Plan">{safe(sim_plan)}</Row>
              <Row label="Valid Till">{toHuman(sim_valid_till)}</Row>
            </div>
          )}

          {isMobile(category) && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Row label="Phone No">{safe(mob_phone)}</Row>
              <Row label="IMEI 1">{safe(mob_imei1)}</Row>
              <Row label="IMEI 2">{safe(mob_imei2)}</Row>
              <Row label="OS">{safe(mob_os)}</Row>
            </div>
          )}

          {isVehicle(category) && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Row label="Reg No">{safe(veh_reg)}</Row>
              <Row label="Type">{safe(veh_type)}</Row>
              <Row label="Fuel">{safe(veh_fuel)}</Row>
              <Row label="Insurance Till">{toHuman(veh_insurance_till)}</Row>
            </div>
          )}

          {isHardwareCategory(category) && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Row label="Email">{safe(email)}</Row>
              <Row label="Installed On">{safe(installed_on)}</Row>
              <Row label="CPU">{safe(processor)}</Row>
              <Row label="OS">{safe(operating_system)}</Row>
              <Row label="RAM">{safe(ram_text)}</Row>
              <Row label="Disk">{safe(disk_text)}</Row>
              <Row label="Apps">{safe(applications_installed)}</Row>
              <Row label="Prev User">{safe(previously_used_by)}</Row>
            </div>
          )}

          {remarks ? <div className="mt-2 text-xs text-gray-700 whitespace-pre-wrap">📝 {remarks}</div> : null}

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[10px] text-gray-400">Updated {toHuman(updated_at)}</div>
            <div className="inline-flex items-center gap-2">
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium px-2.5 py-1.5"
                title="Edit asset"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={onDelete}
                disabled={!canDelete}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title={canDelete ? "Delete asset" : "Cannot delete: missing ID"}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- dynamic placeholders ---------- */
function serialPlaceholder(category) {
  if (isSIM(category)) return "SIM ICCID";
  if (isMobile(category)) return "IMEI";
  if (isVehicle(category)) return "VIN / Chassis No";
  return "Serial No";
}
function brandPlaceholder(category) {
  if (isVehicle(category)) return "Maruti / Honda / Tata…";
  if (isMobile(category)) return "Apple / Samsung / OnePlus…";
  return "HP / Lenovo / Apple…";
}
function modelPlaceholder(category) {
  if (isVehicle(category)) return "Model (e.g., Swift VXi, Activa 5G)";
  if (isMobile(category)) return "iPhone 13 / Galaxy S22…";
  return 'HP 240 G9 / "Smart Tank 580"';
}

/* ---------- Edit modal (full asset update) ---------- */
function EditModal({ row, onClose, onSaved, isDuplicateTag }) {
  // core
  const [category, setCategory] = useState(row.category || "Laptop");
  const [asset_tag, setAssetTag] = useState(row.asset_tag || "");
  const [brand, setBrand] = useState(row.brand || "");
  const [model, setModel] = useState(row.model || "");
  const [serial_no, setSerial] = useState(row.serial_no || "");
  const [company, setCompany] = useState(row.company || "");
  const [status, setStatus] = useState(row.status || "InStock");

  // assignment
  const [assigned_employeeid, setEmpId] = useState(row.assigned_employeeid || "");
  const [assigned_name, setEmpName] = useState(row.assigned_name || "");
  const [assigned_date, setAssignedDate] = useState(row.assigned_date ? String(row.assigned_date).slice(0, 10) : "");

  // purchase
  const [vendor, setVendor] = useState(row.vendor || "");
  const [purchased_on, setPurchasedOn] = useState(row.purchased_on ? String(row.purchased_on).slice(0, 10) : "");
  const [warranty, setWarranty] = useState(row.warranty || "");
  const [location, setLocation] = useState(row.location || "");

  // remarks (freeform only)
  const [remarks, setRemarks] = useState(row.remarks || "");

  // extras (SIM / Mobile / Vehicle) — prefill from row
  const [sim_provider, setSimProvider] = useState(row.sim_provider || "");
  const [sim_number, setSimNumber] = useState(row.sim_number || "");
  const [sim_iccid, setSimICCID] = useState(row.sim_iccid || "");
  const [sim_plan, setSimPlan] = useState(row.sim_plan || "");
  const [sim_valid_till, setSimValidTill] = useState(row.sim_valid_till ? String(row.sim_valid_till).slice(0, 10) : "");

  const [mob_phone, setMobPhone] = useState(row.mob_phone || "");
  const [mob_imei1, setMobImei1] = useState(row.mob_imei1 || "");
  const [mob_imei2, setMobImei2] = useState(row.mob_imei2 || "");
  const [mob_os, setMobOS] = useState(row.mob_os || "");

  const [veh_reg, setVehReg] = useState(row.veh_reg || "");
  const [veh_type, setVehType] = useState(row.veh_type || "");
  const [veh_fuel, setVehFuel] = useState(row.veh_fuel || "");
  const [veh_insurance_till, setVehInsuranceTill] = useState(row.veh_insurance_till ? String(row.veh_insurance_till).slice(0, 10) : "");

  // optional HW specs
  const [email, setEmail] = useState(row.email || "");
  const [installed_on, setInstalledOn] = useState(row.installed_on || "");
  const [processor, setProcessor] = useState(row.processor || "");
  const [operating_system, setOS] = useState(row.operating_system || "");
  const [ram_text, setRam] = useState(row.ram_text || "");
  const [disk_text, setDisk] = useState(row.disk_text || "");
  const [applications_installed, setApps] = useState(row.applications_installed || "");
  const [previously_used_by, setPrevUsed] = useState(row.previously_used_by || "");

  const [saving, setSaving] = useState(false);

  // Auto-switch to "Assigned" if any assignment field is present
  useEffect(() => {
    const hasAssignment = [assigned_employeeid, assigned_name, assigned_date].some(v => String(v || "").trim());
    if (hasAssignment && status !== "Assigned") setStatus("Assigned");
  }, [assigned_employeeid, assigned_name, assigned_date, status]);

  const save = async () => {
    const trimmedTag = String(asset_tag).trim();
    const trimmedCompany = String(company).trim();

    if (!trimmedTag) {
      await Swal.fire({ icon: "warning", title: "Missing Asset Tag", text: "Asset Tag is mandatory." });
      return;
    }
    if (!trimmedCompany) {
      await Swal.fire({ icon: "warning", title: "Missing Company", text: "Company is required for every asset." });
      return;
    }
    if (isDuplicateTag?.(trimmedTag, row.id)) {
      await Swal.fire({ icon: "error", title: "Duplicate Asset Tag", text: `Another asset already uses tag "${trimmedTag}". Please use a unique tag.` });
      return;
    }

    try {
      setSaving(true);
      const hasAssignment = [assigned_employeeid, assigned_name, assigned_date].some(v => String(v || "").trim());

      const body = {
        id: row.id,
        category: category || null,
        asset_tag: trimmedTag,
        brand: brand || null,
        model: model || null,
        serial_no: serial_no || null,
        company: trimmedCompany,
        status: hasAssignment ? "Assigned" : (status || null),

        assigned_employeeid: assigned_employeeid || null,
        assigned_name: assigned_name || null,
        assigned_date: (hasAssignment ? (assigned_date || new Date().toISOString().slice(0, 10)) : assigned_date) || null,

        vendor: vendor || null,
        purchased_on: purchased_on || null,
        warranty: warranty || null,
        location: location || null,

        // Save extras into dedicated columns (no auto-append to remarks)
        sim_provider: sim_provider || null,
        sim_number: sim_number || null,
        sim_iccid: sim_iccid || null,
        sim_plan: sim_plan || null,
        sim_valid_till: sim_valid_till || null,

        mob_phone: mob_phone || null,
        mob_imei1: mob_imei1 || null,
        mob_imei2: mob_imei2 || null,
        mob_os: mob_os || null,

        veh_reg: veh_reg || null,
        veh_type: veh_type || null,
        veh_fuel: veh_fuel || null,
        veh_insurance_till: veh_insurance_till || null,

        email: email || null,
        installed_on: installed_on || null,
        processor: processor || null,
        operating_system: operating_system || null,
        ram_text: ram_text || null,
        disk_text: disk_text || null,
        applications_installed: applications_installed || null,
        previously_used_by: previously_used_by || null,

        remarks: String(remarks || "").trim() || null,
      };

      const res = await fetch("/api/assets/Aindex", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Update failed");

      const updated = j?.row || j?.asset || { ...row, ...body };
      onSaved?.(updated);
      onClose?.();
      await Swal.fire({ icon: "success", title: "Updated", text: "Asset updated." });
    } catch (e) {
      await Swal.fire({ icon: "error", title: "Update failed", text: e.message || "Update failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Update • {row.asset_tag || row.id}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* 4 columns on xl */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Core */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Category</label>
            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Status</label>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Company</label>
            <input value={company} onChange={(e)=>setCompany(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="ASF / AGB / ANM / ASF-Factory" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Asset Tag <span className="text-red-600">*</span></label>
            <input value={asset_tag} onChange={(e)=>setAssetTag(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. LT44-ArunaN" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Brand</label>
            <input value={brand} onChange={(e)=>setBrand(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={brandPlaceholder(category)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Model</label>
            <input value={model} onChange={(e)=>setModel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={modelPlaceholder(category)} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">{serialPlaceholder(category)}</label>
            <input value={serial_no} onChange={(e)=>setSerial(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>

          {/* Assignment */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Assigned To (Emp ID)</label>
            <input value={assigned_employeeid} onChange={(e)=>setEmpId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="EMP123" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Assigned To (Name)</label>
            <input value={assigned_name} onChange={(e)=>setEmpName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Assigned Date</label>
            <input type="date" value={assigned_date} onChange={(e)=>setAssignedDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>

          {/* Purchase */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Vendor</label>
            <input value={vendor} onChange={(e)=>setVendor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Purchased On</label>
            <input type="date" value={purchased_on} onChange={(e)=>setPurchasedOn(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Warranty</label>
            <input value={warranty} onChange={(e)=>setWarranty(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="1 Year / 3 Years…" />
          </div>
          <div className="md:col-span-2 lg:col-span-1 xl:col-span-1">
            <label className="block text-sm text-gray-700 mb-1">Location</label>
            <input value={location} onChange={(e)=>setLocation(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Sircilla Factory / Manikonda WH / One West…" />
          </div>

          {/* Dynamic Extras */}
          {isSIM(category) && (
            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
              <div className="text-sm font-medium text-gray-900 mb-2">SIM Details</div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Provider</label><input value={sim_provider} onChange={(e)=>setSimProvider(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Airtel / Jio / VI" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Phone Number</label><input value={sim_number} onChange={(e)=>setSimNumber(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">ICCID</label><input value={sim_iccid} onChange={(e)=>setSimICCID(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Plan</label><input value={sim_plan} onChange={(e)=>setSimPlan(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Prepaid / Postpaid" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Valid Till</label><input type="date" value={sim_valid_till} onChange={(e)=>setSimValidTill(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
            </div>
          )}

          {isMobile(category) && (
            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
              <div className="text-sm font-medium text-gray-900 mb-2">Mobile Details</div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Phone Number</label><input value={mob_phone} onChange={(e)=>setMobPhone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">IMEI 1</label><input value={mob_imei1} onChange={(e)=>setMobImei1(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">IMEI 2</label><input value={mob_imei2} onChange={(e)=>setMobImei2(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">OS</label><input value={mob_os} onChange={(e)=>setMobOS(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="iOS / Android + version" /></div>
              </div>
            </div>
          )}

          {isVehicle(category) && (
            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
              <div className="text-sm font-medium text-gray-900 mb-2">Vehicle Details</div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Registration No</label><input value={veh_reg} onChange={(e)=>setVehReg(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="TS09 AB 1234" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Type</label><input value={veh_type} onChange={(e)=>setVehType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Car / Bike / Van" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Fuel</label><input value={veh_fuel} onChange={(e)=>setVehFuel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Petrol / Diesel / EV" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Insurance Valid Till</label><input type="date" value={veh_insurance_till} onChange={(e)=>setVehInsuranceTill(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
            </div>
          )}

          {/* HW specs (optional, only for hardware) */}
          {isHardwareCategory(category) && (
            <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
              <div className="text-sm font-medium text-gray-900 mb-2">Specs (optional)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Email</label><input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Installed On</label><input value={installed_on} onChange={(e)=>setInstalledOn(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="free text or date" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Processor</label><input value={processor} onChange={(e)=>setProcessor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Operating System</label><input value={operating_system} onChange={(e)=>setOS(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">RAM</label><input value={ram_text} onChange={(e)=>setRam(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="8 GB / 16 GB" /></div>
                <div><label className="block text sm text-gray-700 mb-1">Disk</label><input value={disk_text} onChange={(e)=>setDisk(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="512 GB / 1 TB" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Applications</label><input value={applications_installed} onChange={(e)=>setApps(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Adobe, Chrome, Teams…" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Previously Used By</label><input value={previously_used_by} onChange={(e)=>setPrevUsed(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4">
            <label className="block text-sm text-gray-700 mb-1">Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e)=>setRemarks(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Create modal ---------- */
function CreateAssetModal({ onClose, onCreated, existingTags, onOpenEditByTag }) {
  // core fields
  const [category, setCategory] = useState("Laptop");
  const [asset_tag, setAssetTag] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial_no, setSerial] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("InStock");

  // assignment
  const [assigned_employeeid, setEmpId] = useState("");
  const [assigned_name, setEmpName] = useState("");
  const [assigned_date, setAssignedDate] = useState("");

  // purchase
  const [vendor, setVendor] = useState("");
  const [purchased_on, setPurchasedOn] = useState("");
  const [warranty, setWarranty] = useState("");
  const [location, setLocation] = useState("");

  // remarks (freeform only)
  const [remarks, setRemarks] = useState("");

  // extras (SIM / Mobile / Vehicle)
  const [sim_provider, setSimProvider] = useState("");
  const [sim_number, setSimNumber] = useState("");
  const [sim_iccid, setSimICCID] = useState("");
  const [sim_plan, setSimPlan] = useState("");
  const [sim_valid_till, setSimValidTill] = useState("");

  const [mob_phone, setMobPhone] = useState("");
  const [mob_imei1, setMobImei1] = useState("");
  const [mob_imei2, setMobImei2] = useState("");
  const [mob_os, setMobOS] = useState("");

  const [veh_reg, setVehReg] = useState("");
  const [veh_type, setVehType] = useState("");
  const [veh_fuel, setVehFuel] = useState("");
  const [veh_insurance_till, setVehInsuranceTill] = useState("");

  // optional HW specs (only shown for hardware categories)
  const [email, setEmail] = useState("");
  const [installed_on, setInstalledOn] = useState("");
  const [processor, setProcessor] = useState("");
  const [operating_system, setOS] = useState("");
  const [ram_text, setRam] = useState("");
  const [disk_text, setDisk] = useState("");
  const [applications_installed, setApps] = useState("");
  const [previously_used_by, setPrevUsed] = useState("");

  const [saving, setSaving] = useState(false);

  // Auto-switch to "Assigned" if any assignment field is present
  useEffect(() => {
    const hasAssignment = [assigned_employeeid, assigned_name, assigned_date].some(v => String(v || "").trim());
    if (hasAssignment && status !== "Assigned") setStatus("Assigned");
  }, [assigned_employeeid, assigned_name, assigned_date, status]);

  const validate = () => {
    if (!category) return "Category is required.";
    if (!String(company).trim()) return "Company is required.";
    if (!String(asset_tag).trim()) return "Asset Tag is mandatory.";
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      await Swal.fire({ icon: "warning", title: "Missing info", text: err });
      return;
    }

    const trimmedTag = String(asset_tag).trim();
    const tagKey = trimmedTag.toLowerCase();

    if (existingTags?.has(tagKey)) {
      const open = await Swal.fire({
        icon: "info",
        title: "Duplicate Asset Tag",
        text: `An asset with tag "${trimmedTag}" already exists. Do you want to edit that asset instead?`,
        showCancelButton: true,
        confirmButtonText: "Open Edit",
        cancelButtonText: "Stay here",
        confirmButtonColor: "#C1272D",
      }).then(r => r.isConfirmed);
      if (open) {
        onClose?.();
        onOpenEditByTag?.(trimmedTag);
        return;
      }
      return; // hard block creation on duplicate
    }

    try {
      setSaving(true);
      const hasAssignment = [assigned_employeeid, assigned_name, assigned_date].some(v => String(v || "").trim());

      const body = {
        category,
        asset_tag: trimmedTag,
        brand: brand || null,
        model: model || null,
        serial_no: serial_no || null,
        company: String(company).trim(),
        status: hasAssignment ? "Assigned" : status,

        assigned_employeeid: assigned_employeeid || null,
        assigned_name: assigned_name || null,
        assigned_date: (hasAssignment ? (assigned_date || new Date().toISOString().slice(0, 10)) : assigned_date) || null,

        vendor: vendor || null,
        purchased_on: purchased_on || null,
        warranty: warranty || null,
        location: location || null,

        // Save extras into dedicated columns
        sim_provider: sim_provider || null,
        sim_number: sim_number || null,
        sim_iccid: sim_iccid || null,
        sim_plan: sim_plan || null,
        sim_valid_till: sim_valid_till || null,

        mob_phone: mob_phone || null,
        mob_imei1: mob_imei1 || null,
        mob_imei2: mob_imei2 || null,
        mob_os: mob_os || null,

        veh_reg: veh_reg || null,
        veh_type: veh_type || null,
        veh_fuel: veh_fuel || null,
        veh_insurance_till: veh_insurance_till || null,

        email: email || null,
        installed_on: installed_on || null,
        processor: processor || null,
        operating_system: operating_system || null,
        ram_text: ram_text || null,
        disk_text: disk_text || null,
        applications_installed: applications_installed || null,
        previously_used_by: previously_used_by || null,

        remarks: String(remarks || "").trim() || null,
      };

      const res = await fetch("/api/assets/Aindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Create failed");
      const newId = j?.id;

      if (newId) {
        const r2 = await fetch(`/api/assets/Aindex?id=${encodeURIComponent(newId)}`);
        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok && j2?.asset) {
          onCreated?.(j2.asset);
        } else {
          onCreated?.(j?.row || { ...body, id: newId });
        }
      } else {
        onCreated?.(j?.asset || j?.row || j);
      }
      onClose?.();
      await Swal.fire({ icon: "success", title: "Created", text: "Asset created." });
    } catch (e) {
      await Swal.fire({ icon: "error", title: "Create failed", text: e.message || "Create failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
   <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative w-full sm:max-w-[95vw] md:max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[95vh] overflow-y-auto bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Add Asset</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>

      {/* 4 columns on xl */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Core */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Category</label>
          <select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Status</label>
          <select value={status} onChange={(e)=>setStatus(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Company</label>
          <input value={company} onChange={(e)=>setCompany(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="ASF / AGB / ANM / ASF-Factory" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Asset Tag <span className="text-red-600">*</span></label>
          <input value={asset_tag} onChange={(e)=>setAssetTag(e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. LT44-ArunaN" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Brand</label>
          <input value={brand} onChange={(e)=>setBrand(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={brandPlaceholder(category)} />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Model</label>
          <input value={model} onChange={(e)=>setModel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={modelPlaceholder(category)} />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">{serialPlaceholder(category)}</label>
          <input value={serial_no} onChange={(e)=>setSerial(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        {/* Assignment */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Assigned To (Emp ID)</label>
          <input value={assigned_employeeid} onChange={(e)=>setEmpId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="EMP123" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Assigned To (Name)</label>
          <input value={assigned_name} onChange={(e)=>setEmpName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Full name" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Assigned Date</label>
          <input type="date" value={assigned_date} onChange={(e)=>setAssignedDate(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        {/* Purchase */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Vendor</label>
          <input value={vendor} onChange={(e)=>setVendor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Purchased On</label>
          <input type="date" value={purchased_on} onChange={(e)=>setPurchasedOn(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Warranty</label>
          <input value={warranty} onChange={(e)=>setWarranty(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="1 Year / 3 Years…" />
        </div>
        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1">
          <label className="block text-sm text-gray-700 mb-1">Location</label>
          <input value={location} onChange={(e)=>setLocation(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Sircilla Factory / Manikonda WH / One West…" />
        </div>

        {/* Dynamic Extras */}
        {isSIM(category) && (
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
            <div className="text-sm font-medium text-gray-900 mb-2">SIM Details</div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div><label className="block text-sm text-gray-700 mb-1">Provider</label><input value={sim_provider} onChange={(e)=>setSimProvider(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Airtel / Jio / VI" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Phone Number</label><input value={sim_number} onChange={(e)=>setSimNumber(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">ICCID</label><input value={sim_iccid} onChange={(e)=>setSimICCID(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Plan</label><input value={sim_plan} onChange={(e)=>setSimPlan(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Prepaid / Postpaid" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Valid Till</label><input type="date" value={sim_valid_till} onChange={(e)=>setSimValidTill(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
          </div>
        )}

        {isMobile(category) && (
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
            <div className="text-sm font-medium text-gray-900 mb-2">Mobile Details</div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div><label className="block text-sm text-gray-700 mb-1">Phone Number</label><input value={mob_phone} onChange={(e)=>setMobPhone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">IMEI 1</label><input value={mob_imei1} onChange={(e)=>setMobImei1(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">IMEI 2</label><input value={mob_imei2} onChange={(e)=>setMobImei2(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">OS</label><input value={mob_os} onChange={(e)=>setMobOS(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="iOS / Android + version" /></div>
            </div>
          </div>
        )}

        {isVehicle(category) && (
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
            <div className="text-sm font-medium text-gray-900 mb-2">Vehicle Details</div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div><label className="block text-sm text-gray-700 mb-1">Registration No</label><input value={veh_reg} onChange={(e)=>setVehReg(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="TS09 AB 1234" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Type</label><input value={veh_type} onChange={(e)=>setVehType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Car / Bike / Van" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Fuel</label><input value={veh_fuel} onChange={(e)=>setVehFuel(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Petrol / Diesel / EV" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Insurance Valid Till</label><input type="date" value={veh_insurance_till} onChange={(e)=>setVehInsuranceTill(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
          </div>
        )}

        {/* HW specs (optional, only for hardware) */}
        {isHardwareCategory(category) && (
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 pt-2">
            <div className="text-sm font-medium text-gray-900 mb-2">Specs (optional)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div><label className="block text-sm text-gray-700 mb-1">Email</label><input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Installed On</label><input value={installed_on} onChange={(e)=>setInstalledOn(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="free text or date" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Processor</label><input value={processor} onChange={(e)=>setProcessor(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Operating System</label><input value={operating_system} onChange={(e)=>setOS(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">RAM</label><input value={ram_text} onChange={(e)=>setRam(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="8 GB / 16 GB" /></div>
              <div><label className="block text sm text-gray-700 mb-1">Disk</label><input value={disk_text} onChange={(e)=>setDisk(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="512 GB / 1 TB" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Applications</label><input value={applications_installed} onChange={(e)=>setApps(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Adobe, Chrome, Teams…" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Previously Used By</label><input value={previously_used_by} onChange={(e)=>setPrevUsed(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-700 mb-1">Remarks</label>
          <textarea rows={1} value={remarks} onChange={(e)=>setRemarks(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60">
          {saving ? "Saving…" : "Create Asset"}
        </button>
      </div>
    </div>
   </div>
  );
}

/* ---------- main page ---------- */
export default function AssetsPage() {
  const router = useRouter();

  // Header wiring
  const [hrName, setHrName] = useState("HR");
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try a simple /api/me first
        const r = await fetch("/api/me");
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setHrName(j?.name || j?.hrName || "HR");
      } catch {
        if (!cancelled) setHrName("HR");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openProfile = async () => {
    try {
      // Prefer /api/me if it returns a full user
      let me = null;
      try {
        const r = await fetch("/api/me");
        const j = await r.json().catch(() => ({}));
        if (j && (j.employeeid || j?.user?.employeeid)) me = j.user || j;
      } catch {}

      // Fallback to ID/email lookup
      if (!me) {
        const { id, email } = getAuthIdentity();
        if (id) {
          const r = await fetch(`/api/users?id=${encodeURIComponent(id)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok && Array.isArray(j?.data) && j.data.length) me = j.data[0];
        }
        if (!me && email) {
          const r = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
          const j = await r.json().catch(() => ({}));
          if (r.ok && Array.isArray(j?.data) && j.data.length) me = j.data[0];
        }
      }

      if (!me) throw new Error("Your profile could not be found");
      setProfileUser(me);
      setShowProfile(true);
    } catch (e) {
      await Swal.fire({ icon: "error", title: "Profile", text: e.message || "Unable to load profile" });
    }
  };

  const logout = async () => {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("hr_auth");
        localStorage.removeItem("hr_role");
        localStorage.removeItem("hr_employeeid");
        localStorage.removeItem("hr_email");
        localStorage.removeItem("auth");
        localStorage.removeItem("remember");
      }
    } catch {}
    try { router.replace("/Hlogin"); } catch {}
    if (typeof window !== "undefined") setTimeout(() => window.location.replace("/Hlogin"), 50);
  };

  // Assets data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");

  const [editRow, setEditRow] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAssets = async () => {
    try {
      setLoading(true); setErr("");
      const res = await fetch("/api/assets/Aindex");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to load assets");
      setRows(Array.isArray(j?.rows || j?.data) ? (j.rows || j.data) : []);
    } catch (e) {
      setErr(e.message || "Failed to load assets");
      setRows([]);
      await Swal.fire({ icon: "error", title: "Assets", text: e.message || "Failed to load assets" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(); }, []);

  /* existing tags set for duplicate checks */
  const existingTags = useMemo(() => {
    const s = new Set();
    for (const r of rows || []) {
      const t = String(r?.asset_tag || "").trim().toLowerCase();
      if (t) s.add(t);
    }
    return s;
  }, [rows]);

  /* derive filters + counts */
  const categories = useMemo(() => {
    const set = new Set();
    (rows || []).forEach(r => set.add(r.category || "—"));
    return Array.from(set).sort();
  }, [rows]);

  const statuses = useMemo(() => {
    const set = new Set();
    (rows || []).forEach(r => set.add(r.status || "InStock"));
    return Array.from(set).sort();
  }, [rows]);

  const companies = useMemo(() => {
    const set = new Set();
    (rows || []).forEach(r => set.add(mapCompany(r.company)));
    return Array.from(set).sort((a,b)=> a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter(r => {
      const hay = [
        r.asset_tag, r.category, r.brand, r.model, r.serial_no,
        r.assigned_employeeid, r.assigned_name,
        r.vendor, r.location, r.company,
      ].map(x => String(x ?? "").toLowerCase()).join(" ");
      const passQ = q ? hay.includes(q) : true;
      const passCat = catFilter === "ALL" ? true : String(r.category || "").toLowerCase() === catFilter.toLowerCase();
      const passStatus = statusFilter === "ALL" ? true : String(r.status || "InStock").toLowerCase() === statusFilter.toLowerCase();
      const passCompany = companyFilter === "ALL" ? true : mapCompany(r.company) === companyFilter;
      return passQ && passCat && passStatus && passCompany;
    });
  }, [rows, search, catFilter, statusFilter, companyFilter]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const assigned = filtered.filter(r => String(r.status || "").toLowerCase() === "assigned").length;
    const instock = filtered.filter(r => String(r.status || "instock").toLowerCase() === "instock").length;
    const repair = filtered.filter(r => /repair|service/i.test(String(r.status || ""))).length;
    return { total, assigned, instock, repair };
  }, [filtered]);

  /* group by category for display */
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of filtered) {
      const k = r.category || "Other";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return Array.from(m.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
  }, [filtered]);

  const resetFilters = () => {
    setSearch("");
    setCatFilter("ALL");
    setStatusFilter("ALL");
    setCompanyFilter("ALL");
  };

  const isDuplicateTag = (tag, excludeId = null) => {
    const key = String(tag || "").trim().toLowerCase();
    if (!key) return false;
    return (rows || []).some(r => {
      const k = String(r?.asset_tag || "").trim().toLowerCase();
      if (!k) return false;
      if (excludeId && r?.id === excludeId) return false;
      return k === key;
    });
  };

  const openEditByTag = (tag) => {
    const key = String(tag || "").trim().toLowerCase();
    const found = (rows || []).find(r => String(r?.asset_tag || "").trim().toLowerCase() === key);
    if (found) setEditRow(found);
  };

  // SweetAlert-powered delete
  const handleDelete = async (row) => {
    if (!row?.id) {
      await Swal.fire({ icon: "warning", title: "Cannot delete", text: "This asset does not have an ID yet. Deletion is disabled in the UI." });
      return;
    }
    const name = row.asset_tag || row.serial_no || `#${row.id}`;

    const ok = await Swal.fire({
      icon: "warning",
      title: "Delete asset?",
      text: `Asset ${name} will be permanently deleted.`,
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (!ok) return;

    try {
      let res = await fetch(`/api/assets/Aindex?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const j1 = await res.json().catch(() => ({}));
        if (res.status === 405 || res.status === 400) {
          // fallback (if backend implemented as PUT action=delete)
          res = await fetch("/api/assets/Aindex", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", ids: [row.id] }),
          });
        } else {
          throw new Error(j1?.error || "Delete failed");
        }
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");

      setRows((prev) => prev.filter((x) => x.id !== row.id));
      await Swal.fire({ icon: "success", title: "Deleted", text: `Asset ${name} removed.` });
    } catch (e) {
      await Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Delete failed" });
    }
  };

  return (
    <div className="min-h-screen ">
      <AppHeader
        currentPath={router.pathname}
        hrName={hrName}
        onProfileClick={openProfile}
        onLogout={logout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Top hero-ish header */}
        <div className="rounded-2xl border border-violet-100 p-5 md:p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">Assets</h1>
              <p className="text-sm text-gray-600">All hardware with filters, quick search, and inline updates.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAssets}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#C1272D] px-3 py-2 text-sm font-medium text-white hover:bg-[#a02125]"
              >
                <Plus className="h-4 w-4" /> Add Asset
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Kpi label="Total" value={kpis.total}  />
            <Kpi label="Assigned" value={kpis.assigned}  />
            <Kpi label="In Stock" value={kpis.instock} />
            <Kpi label="Repair/Service" value={kpis.repair} />
          </div>
        </div>

        {/* Controls */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 md:py-6">
          <div className="grid gap-4 md:grid-cols-[minmax(280px,1fr)_repeat(3,180px)_auto] items-end">
            {/* search */}
            <div className="w-full">
              <label className="block text-xs text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
                <input
                  type="text"
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  placeholder="tag, serial, model, name, vendor…"
                  className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-9 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
                {search ? (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={()=>setSearch("")}
                    type="button"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>

            {/* filters */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={catFilter}
                onChange={(e)=>setCatFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm"
              >
                <option value="ALL">All</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e)=>setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm"
              >
                <option value="ALL">All</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Company</label>
              <select
                value={companyFilter}
                onChange={(e)=>setCompanyFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm shadow-sm"
              >
                <option value="ALL">All</option>
                {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* reset */}
            <div className="justify-self-start md:justify-self-end">
              <label className="block text-xs text-transparent mb-1 select-none">Reset</label>
              <button
                onClick={resetFilters}
                type="button"
                className="h-10 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" aria-hidden /> Reset
              </button>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="mt-6 md:mt-8">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600 shadow-sm">
              Loading assets…
            </div>
          ) : err ? (
            <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-600 shadow-sm">
              {err}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-600 shadow-sm">
              No assets match your filters.
            </div>
          ) : (
            grouped.map(([cat, items]) => (
              <div key={cat} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-900">
                    <CatIcon category={cat} className="h-4 w-4 text-gray-700" />
                    {cat}
                  </div>
                  <span className="text-xs text-gray-500">• {items.length}</span>
                </div>
                <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => (
                    <AssetCard
                      key={r.id || r.asset_tag || `${r.category}-${r.serial_no}`}
                      row={r}
                      onEdit={() => setEditRow(r)}
                      onDelete={() => handleDelete(r)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Modals */}
      {editRow ? (
        <EditModal
          row={editRow}
          isDuplicateTag={(tag, excludeId) => isDuplicateTag(tag, excludeId)}
          onClose={() => setEditRow(null)}
          onSaved={(updated) => {
            setRows((prev) => {
              const byIdIdx = prev.findIndex(x => x.id && updated.id && x.id === updated.id);
              if (byIdIdx >= 0) {
                const next = [...prev];
                next[byIdIdx] = { ...prev[byIdIdx], ...updated };
                return next;
              }
              // fallback: merge by asset_tag
              const key = String(updated.asset_tag || "").trim().toLowerCase();
              const byTagIdx = prev.findIndex(x => String(x.asset_tag || "").trim().toLowerCase() === key && key);
              if (byTagIdx >= 0) {
                const next = [...prev];
                next[byTagIdx] = { ...prev[byTagIdx], ...updated };
                return next;
              }
              // else append
              return [updated, ...prev];
            });
            setEditRow(null);
          }}
        />
      ) : null}

      {showCreate ? (
        <CreateAssetModal
          existingTags={existingTags}
          onOpenEditByTag={openEditByTag}
          onClose={() => setShowCreate(false)}
          onCreated={(newRow) => {
            setRows((prev) => [newRow, ...prev]);
            setShowCreate(false);
          }}
        />
      ) : null}

      {showProfile && profileUser ? (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfile(false)}
          onSaved={(updated) => {
            setShowProfile(false);
            if (updated?.name) setHrName(updated.name);
            Swal.fire({
              icon: "success",
              title: "Profile updated",
              text: "Your changes have been saved.",
              confirmButtonColor: "#C1272D",
            });
            fetchAssets();
          }}
        />
      ) : null}
    </div>
  );
}
