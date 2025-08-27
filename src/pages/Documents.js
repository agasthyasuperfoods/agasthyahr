// src/pages/Documents.js
import React, { useMemo, useRef, useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AppHeader from "@/components/AppHeader";
import {
  FileText,
  Upload,
  Search as SearchIcon,
  ShieldCheck,
  Download,
  Link2,
  X as XIcon,
  AlertTriangle,
  Archive,
  CheckCircle2,
} from "lucide-react";

/* ------------ constants (used by ProfileModal) ------------ */
const ROLES = ["ADMIN", "HR", "FINANCE", "EMPLOYEE"];

/* ------------ small helpers ------------ */
function classNames(...a) { return a.filter(Boolean).join(" "); }
function formatSize(mb) { return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`; }
function formatWhen(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(); }
function ym(d=new Date()){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');return `${y}-${m}`;}
function getAuthIdentity() {
  if (typeof window === "undefined") return { id: null, email: null };
  const ls = window.localStorage;
  return {
    id: ls.getItem("hr_employeeid") || null,
    email: ls.getItem("hr_email") || null,
  };
}

// ======================================
// HR → Documents (Docs + Payroll Data)
// ======================================

const MOCK_DOCS = [
  { id: "D-0001", title: "HR Policy Handbook v3.2", folder: "Policies", tags: ["policy", "employee"], type: "PDF", size: 2.4, updatedAt: "2025-08-20T10:00:00Z", owner: "HR", status: "Active", version: "3.2", url: "#" },
  { id: "D-0002", title: "Offer Letter Template", folder: "Onboarding", tags: ["offer", "template"], type: "DOCX", size: 0.3, updatedAt: "2025-08-22T08:15:00Z", owner: "HR", status: "Active", version: "1.0", url: "#" },
  { id: "D-0004", title: "PF & ESI – Compliance Checklist", folder: "Compliance", tags: ["compliance", "PF", "ESI"], type: "PDF", size: 0.9, updatedAt: "2025-08-24T11:00:00Z", owner: "HR", status: "Active", version: "2.1", url: "#" },
  { id: "D-0005", title: "Vendor Agreement – 2025 Template", folder: "Agreements", tags: ["agreement", "vendor"], type: "DOCX", size: 0.6, updatedAt: "2025-08-11T09:30:00Z", owner: "Legal", status: "Active", version: "1.4", url: "#" },
  { id: "D-0006", title: "Exit Kit Template", folder: "Exit", tags: ["exit", "template"], type: "PDF", size: 0.7, updatedAt: "2025-08-10T09:00:00Z", owner: "HR", status: "Active", version: "1.0", url: "#" },
];

const FOLDERS = [
  { key: "All", label: "All Documents", icon: FileText },
  { key: "Policies", label: "Policies", icon: ShieldCheck },
  { key: "Onboarding", label: "Onboarding", icon: CheckCircle2 },
  { key: "Payroll", label: "Payroll", icon: FileText },
  { key: "Compliance", label: "Compliance", icon: ShieldCheck },
  { key: "Agreements", label: "Agreements", icon: FileText },
  { key: "Exit", label: "Exit", icon: Archive },
  { key: "Other", label: "Other", icon: FileText },
];

// Payroll demo seed (only if API not wired yet)
const MOCK_PAYROLL = [
  { employeeid: "EMP1001", name: "A. Kumar", dept: "Eng", gross: 60000, deductions: 5000, net: 55000, status: "Paid", paid_on: "2025-08-02" },
  { employeeid: "EMP1042", name: "S. Reddy", dept: "Sales", gross: 42000, deductions: 3000, net: 39000, status: "Paid", paid_on: "2025-08-02" },
  { employeeid: "EMP0874", name: "P. Singh", dept: "Ops", gross: 38000, deductions: 2800, net: 35200, status: "Pending", paid_on: null },
];

export default function DocumentsPage() {
  // ----- Header wiring -----
  const router = useRouter();
  const [hrName, setHrName] = useState("HR");
  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        const j = await res.json().catch(() => ({}));
        if (!cancelled) setHrName(j?.name || j?.hrName || "HR");
      } catch {
        if (!cancelled) setHrName("HR");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openProfile = async () => {
    try {
      const { id, email } = getAuthIdentity();
      let me = null;

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
      if (!me) throw new Error("Your profile could not be found");

      setProfileUser(me);
      setShowProfile(true);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Profile", text: e.message || "Unable to load profile" });
    }
  };

  const logout = async () => {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    try {
      localStorage.removeItem("hr_auth");
      localStorage.removeItem("auth_role");
      localStorage.removeItem("auth");
      localStorage.removeItem("remember");
      localStorage.removeItem("token");
    } catch {}
    router.replace("/Hlogin");
  };

  // ----- Documents state -----
  const [docs, setDocs] = useState(MOCK_DOCS);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("All");
  const [view, setView] = useState("grid"); // 'grid' | 'list'
  const [selectedMap, setSelectedMap] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [shareDoc, setShareDoc] = useState(null);

  // ----- Payroll state -----
  const [payrollMonth, setPayrollMonth] = useState(ym());
  const [payrollRows, setPayrollRows] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState("");

  const openDoc = (doc) => {
    const url = doc?.url || "#";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Filtered docs (never show docs for Payroll)
  const filtered = useMemo(() => {
    let arr = [...docs];
    if (folder !== "All") arr = arr.filter((d) => d.folder === folder);
    if (folder === "Payroll") return [];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((d) => [d.title, d.id, d.tags?.join(" "), d.folder].join(" ").toLowerCase().includes(q));
    }
    arr.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return arr;
  }, [docs, folder, query]);

  const selectedIds = useMemo(() => Object.keys(selectedMap).filter((k) => selectedMap[k]), [selectedMap]);
  const anySelected = folder !== "Payroll" && selectedIds.length > 0;
  const toggleOne = (id) => setSelectedMap((m) => ({ ...m, [id]: !m[id] }));

  // Payroll fetch
  useEffect(() => {
    if (folder !== "Payroll") return;
    let cancelled = false;
    (async () => {
      try {
        setPayrollLoading(true); setPayrollError("");
        const res = await fetch(`/api/payroll?month=${encodeURIComponent(payrollMonth)}`);
        if (!res.ok) throw new Error("Failed to load payroll");
        const j = await res.json().catch(()=>({}));
        const rows = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        if (!cancelled) setPayrollRows(rows);
      } catch (e) {
        if (!cancelled) { setPayrollError(e?.message || "Failed to load payroll"); setPayrollRows(MOCK_PAYROLL); }
      } finally {
        if (!cancelled) setPayrollLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [folder, payrollMonth]);

  // Payroll CSV download (API-first, then client CSV)
  const downloadPayroll = async () => {
    const filename = `payroll_${payrollMonth}.csv`;
    try {
      const res = await fetch(`/api/payroll/export?month=${encodeURIComponent(payrollMonth)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        return;
      }
    } catch {}
    const rows = payrollRows || [];
    const headers = ["employeeid","name","dept","gross","deductions","net","status","paid_on"];
    const esc = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g,'""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => esc(r[h])).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // Upload dropzone
  const Dropzone = ({ onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
      const el = ref.current; if (!el) return;
      const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
      ["dragenter","dragover","dragleave","drop"].forEach((ev) => el.addEventListener(ev, stop));
      return () => ["dragenter","dragover","dragleave","drop"].forEach((ev) => el.removeEventListener(ev, stop));
    }, []);
    const onFiles = (files) => {
      const list = Array.from(files || []); if (!list.length) return;
      const now = new Date().toISOString();
      const mapped = list.map((f, i) => ({
        id: `TMP-${Date.now()}-${i}`,
        title: f.name,
        folder: folder === "All" ? "Other" : folder,
        tags: [],
        type: (f.name.split(".").pop()||"FILE").toUpperCase(),
        size: Math.max(0.1, f.size/(1024*1024)),
        updatedAt: now,
        owner: "HR",
        status: "Active",
        version: "1.0",
        url: "#",
      }));
      setDocs((prev) => [...mapped, ...prev]);
      onClose?.();
    };
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div ref={ref} className="relative w-full sm:max-w-[95vw] md:max-w-3xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-6 m-0 md:m-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Upload documents</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><XIcon className="h-5 w-5"/></button>
          </div>
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center relative">
            <Upload className="h-10 w-10 inline-block" />
            <div className="mt-2 text-sm text-gray-700">Drag & drop files here, or click to browse</div>
            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e)=>onFiles(e.target.files)} />
          </div>
          <div className="mt-4 text-xs text-gray-500">Accepted: PDF, DOCX, XLSX, CSV, PNG/JPG. Max 25MB/file.</div>
        </div>
      </div>
    );
  };

  const DocCard = ({ d }) => (
    <div className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden cursor-pointer" onClick={() => openDoc(d)}>
      <div className="flex items-start gap-3 p-3">
        <input type="checkbox" className="mt-1" checked={!!selectedMap[d.id]} onChange={(e) => { e.stopPropagation(); toggleOne(d.id); }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border border-gray-200 bg-gray-50 text-gray-700">{d.type}</span>
                {d.status === "Pending Approval" && (
                  <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="h-3 w-3"/>Pending</span>
                )}
                {d.status === "Archived" && (
                  <span className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 border border-gray-200"><Archive className="h-3 w-3"/>Archived</span>
                )}
              </div>
              <div className="mt-1 font-medium text-gray-900 whitespace-normal break-words" title={d.title}>{d.title}</div>
              <div className="mt-0.5 text-xs text-gray-500 whitespace-normal break-words">{d.folder} • v{d.version} • {formatSize(d.size)} • Updated {formatWhen(d.updatedAt)}</div>
              {d.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.tags.map((t) => (
                    <span key={t} className="text-[10px] rounded-full px-2 py-0.5 bg-blue-50 text-blue-700">{t}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button className="p-2 rounded-lg hover:bg-gray-100" title="Download" onClick={() => openDoc(d)}><Download className="h-4 w-4"/></button>
              <button className="p-2 rounded-lg hover:bg-gray-100" title="Share link" onClick={() => setShareDoc(d)}><Link2 className="h-4 w-4"/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ListView = () => (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr className="text-left">
            <th className="px-3 py-2 border-b">Select</th>
            <th className="px-3 py-2 border-b">Title</th>
            <th className="px-3 py-2 border-b">Folder</th>
            <th className="px-3 py-2 border-b">Type</th>
            <th className="px-3 py-2 border-b">Size</th>
            <th className="px-3 py-2 border-b">Updated</th>
            <th className="px-3 py-2 border-b">Status</th>
            <th className="px-3 py-2 border-b text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id} className="odd:bg-white even:bg-gray-50 align-top">
              <td className="px-3 py-2 border-t"><input type="checkbox" checked={!!selectedMap[d.id]} onChange={()=>toggleOne(d.id)} /></td>
              <td className="px-3 py-2 border-t">
                <button className="font-medium text-gray-900 whitespace-normal break-words text-left hover:underline" onClick={() => openDoc(d)}>{d.title}</button>
                <div className="text-xs text-gray-500 whitespace-normal break-words">v{d.version} • {d.tags?.join(" ")}</div>
              </td>
              <td className="px-3 py-2 border-t">{d.folder}</td>
              <td className="px-3 py-2 border-t">{d.type}</td>
              <td className="px-3 py-2 border-t">{formatSize(d.size)}</td>
              <td className="px-3 py-2 border-t">{formatWhen(d.updatedAt)}</td>
              <td className="px-3 py-2 border-t">
                {d.status === "Pending Approval" ? (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs"><AlertTriangle className="h-3 w-3"/>Pending</span>
                ) : d.status === "Archived" ? (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-gray-50 text-gray-700 border border-gray-200 text-xs"><Archive className="h-3 w-3"/>Archived</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-xs">Active</span>
                )}
              </td>
              <td className="px-3 py-2 border-t text-right">
                <div className="inline-flex items-center gap-1">
                  <button className="p-1.5 rounded-md hover:bg-gray-100" title="Download" onClick={()=>openDoc(d)}><Download className="h-4 w-4"/></button>
                  <button className="p-1.5 rounded-md hover:bg-gray-100" title="Share" onClick={()=>setShareDoc(d)}><Link2 className="h-4 w-4"/></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const GridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map((d) => <DocCard key={d.id} d={d} />)}
    </div>
  );

  const ShareModal = ({ doc, onClose }) => {
    if (!doc) return null;
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${doc.id}`;
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full sm:max-w-[95vw] md:max-w-xl bg-white border border-gray-200 rounded-2xl shadow-xl p-6 m-0 md:m-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Share document</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><XIcon className="h-5 w-5"/></button>
          </div>
          <div className="text-sm text-gray-700">Generate an internal link (access controlled by roles).</div>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={shareUrl} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"/>
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50" onClick={()=>{navigator.clipboard?.writeText(shareUrl);}}>Copy</button>
          </div>
        </div>
      </div>
    );
  };

  // Toolbar: search + folder picker + view toggle + upload
  const Toolbar = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <SearchIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, ID, tag..."
          className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          disabled={folder === "Payroll"}
        />
      </div>
      <select value={folder} onChange={(e) => setFolder(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
        {FOLDERS.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
      </select>
      {folder !== "Payroll" && (
        <div className="rounded-xl border border-gray-200 bg-white p-1">
          <button
            onClick={() => setView("grid")}
            className={classNames("px-3 py-1.5 text-sm rounded-lg", view === "grid" ? "bg-gray-900 text-white" : "hover:bg-gray-50")}
          >
            Grid
          </button>
          <button
            onClick={() => setView("list")}
            className={classNames("px-3 py-1.5 text-sm rounded-lg", view === "list" ? "bg-gray-900 text-white" : "hover:bg-gray-50")}
          >
            List
          </button>
        </div>
      )}
      <button
        onClick={() => setShowUpload(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        disabled={folder === "Payroll"}
      >
        <Upload className="h-4 w-4"/> Upload
      </button>
    </div>
  );

  const LeftRail = () => (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Folders</div>
        <div className="space-y-1">
          {FOLDERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFolder(key)}
              className={classNames("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm", folder === key ? "bg-gray-900 text-white" : "hover:bg-gray-50")}
            >
              <Icon className="h-4 w-4"/> <span className="whitespace-normal break-words">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const BulkBar = () => (
    <div className="sticky top-[70px] z-20 bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2 flex items-center justify-between">
      <div className="text-sm text-gray-700"><span className="font-semibold">{selectedIds.length}</span> selected</div>
      <div className="flex items-center gap-2">
        <button className="px-2.5 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-sm">Download</button>
        <button className="px-2.5 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm">Delete</button>
      </div>
    </div>
  );

  const PayrollPanel = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Payroll</h3>
          <p className="text-xs text-gray-600">Month-wise payroll fetched from the database.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Month</label>
          <input type="month" value={payrollMonth} onChange={(e)=>setPayrollMonth(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
          <button onClick={downloadPayroll} disabled={payrollLoading} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
            <Download className="h-4 w-4"/> Download CSV
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="text-left">
              <th className="px-3 py-2 border-b">Employee ID</th>
              <th className="px-3 py-2 border-b">Name</th>
              <th className="px-3 py-2 border-b">Dept</th>
              <th className="px-3 py-2 border-b">Gross</th>
              <th className="px-3 py-2 border-b">Deductions</th>
              <th className="px-3 py-2 border-b">Net</th>
              <th className="px-3 py-2 border-b">Status</th>
              <th className="px-3 py-2 border-b">Paid On</th>
            </tr>
          </thead>
          <tbody>
            {payrollLoading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>
            ) : (payrollRows.length ? payrollRows : []).map((r, idx) => (
              <tr key={r.employeeid || idx} className="odd:bg-white even:bg-gray-50">
                <td className="px-3 py-2 border-t">{r.employeeid}</td>
                <td className="px-3 py-2 border-t">{r.name}</td>
                <td className="px-3 py-2 border-t">{r.dept || "-"}</td>
                <td className="px-3 py-2 border-t">{Number(r.gross||0).toLocaleString()}</td>
                <td className="px-3 py-2 border-t">{Number(r.deductions||0).toLocaleString()}</td>
                <td className="px-3 py-2 border-t font-medium">{Number(r.net||0).toLocaleString()}</td>
                <td className="px-3 py-2 border-t">{r.status || "-"}</td>
                <td className="px-3 py-2 border-t">{r.paid_on || "-"}</td>
              </tr>
            ))}
            {!payrollLoading && !payrollRows.length ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No payroll records for {payrollMonth}.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {payrollError ? (
        <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{payrollError} • Showing demo data.</div>
      ) : null}
    </div>
  );

  return (
    <>
      <Head>
        <title>HR Documents</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <AppHeader
          currentPath={router.pathname}
          hrName={hrName}
          onProfileClick={openProfile}
          onLogout={logout}
        />

        <div className="p-4 md:p-6">
          {/* Page Title */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">Documents</h1>
              <p className="text-sm text-gray-600">A simple, centralized repository for HR files — plus month-wise payroll data.</p>
            </div>
          </div>

          {/* Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left rail */}
            <aside className="lg:col-span-3">
              <LeftRail />
            </aside>

            {/* Main */}
            <section className="lg:col-span-9">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <Toolbar />
              </div>

              <div className="mt-4">
                {folder === "Payroll" ? (
                  <PayrollPanel />
                ) : (
                  <>
                    {anySelected && <BulkBar />}
                    {view === "grid" ? <GridView /> : <ListView />}
                    {!filtered.length && (
                      <div className="mt-8 text-center text-sm text-gray-600">No documents match your filters.</div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {showUpload && <Dropzone onClose={()=>setShowUpload(false)} />}
      {shareDoc && <ShareModal doc={shareDoc} onClose={()=>setShareDoc(null)} />}

      {/* Profile Modal */}
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
          }}
        />
      ) : null}
    </>
  );
}

/* ===========================
   Profile Modal (same UX as dashboard; address optional)
   =========================== */
function ProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role || "HR");
  const [doj, setDoj] = useState(user?.doj || "");
  const [phone, setPhone] = useState(user?.number || user?.phone || "");
  const [company, setCompany] = useState(user?.company || "");
  const [aadhaar, setAadhaar] = useState(user?.adhaarnumber || "");
  const [pan, setPan] = useState(user?.pancard || "");
  const [address, setAddress] = useState(user?.address || "");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!name.trim()) return "Full name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Valid email is required.";
    if (!role) return "Role is required.";
    if (!company.trim()) return "Company is required.";
    const aadhaarDigits = String(aadhaar || "").replace(/\D/g, "");
    if (aadhaarDigits && aadhaarDigits.length !== 12) return "Aadhaar must be exactly 12 digits.";
    const panNorm = String(pan || "").toUpperCase();
    if (panNorm && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNorm)) return "PAN format is invalid (e.g., ABCDE1234F).";
    // Address is optional — no validation
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      Swal.fire({ icon: "error", title: "Validation error", text: err });
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        employeeid: user.employeeid,
        name,
        email,
        role,
        doj,
        phone,
        company,
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address: String(address).trim() || null, // optional, normalized
      };
      const res = await fetch(`/api/users?id=${encodeURIComponent(user.employeeid)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to update profile");
      onSaved?.(json?.data || body);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Update failed", text: e.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full md:max-w-3xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 m-0 md:m-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee ID</label>
              <input
                type="text"
                value={user?.employeeid ?? ""}
                readOnly
                disabled
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
                {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
              <input type="date" value={doj || ""} onChange={(e) => setDoj(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="tel" value={phone || ""} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="+91 98765 43210" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ASF-Factory" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Aadhaar (12 digits)</label>
              <input value={aadhaar || ""} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="000000000000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input value={pan || ""} onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="ABCDE1234F" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea rows={2} value={address || ""} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Flat / Street / City / State / PIN" />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center rounded-lg bg-[#C1272D] text-white font-medium px-4 py-2 hover:bg-[#a02125]">
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
