// src/pages/Documents.js
import React, { useMemo, useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AppHeader from "@/components/AppHeader";
import {
  FileText,
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
function getAuthIdentity() {
  if (typeof window === "undefined") return { id: null, email: null };
  const ls = window.localStorage;
  return { id: ls.getItem("hr_employeeid") || null, email: ls.getItem("hr_email") || null };
}

/* ------------ doc helpers (DB → UI) ------------ */
function categorizeDoc(title = "", type = "") {
  const s = `${title} ${type}`.toLowerCase();

  // Letterheads → own tab
  if (/(letter\s*head|letter-head)/.test(s)) return "Letterheads";

  // Put these into Employee Documents
  if (/(confirmation|probation|warning|show cause|disciplinary|charge ?sheet|salary certificate|employment certificate|employment verification|resume|cv|aadhaar|aadhar|pan|id proof|address proof|bank|cheque|uann?|esi card|pf)/.test(s)) {
    return "Employee Documents";
  }

  // Letters / company docs
  if (/(offer|appointment|joining|letter of intent)/.test(s)) return "Onboarding";
  if (/(increment|hike|revision|salary revision|compensation revision)/.test(s)) return "Increment/Revision";
  if (/(promotion|transfer)/.test(s)) return "Promotion/Transfer";
  if (/(reliev|exit|separation|experience letter)/.test(s)) return "Exit";
  if (/(policy|handbook|posh|leave policy|attendance policy|travel policy|wfh)/.test(s)) return "Policies";
  if (/(agreement|contract|nda|vendor|service agreement)/.test(s)) return "Agreements";
  if (/(compliance|pf|esi|statut|tax|professional tax|gst|challan|return|register)/.test(s)) return "Compliance";

  return "Other";
}

function normalizeDoc(row, i = 0) {
  const id = row.id ?? `ROW-${i}`;
  const title = row.name ?? `Untitled ${id}`;
  const inferredType = (row.type || (row.url?.split(".").pop() || "")).toUpperCase();
  return {
    id: String(id),
    title,
    folder: categorizeDoc(title, inferredType),
    tags: [inferredType.toLowerCase()].filter(Boolean),
    type: inferredType || "FILE",
    size: 0.1, // unknown size; placeholder (MB)
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    owner: "HR",
    status: "Active",
    version: "1.0",
    url: row.url || "#",
  };
}

// ======================================
// HR → Documents (no upload, no select)
// ======================================

const MOCK_DOCS = [
  { id: "D-0001", title: "HR Policy Handbook v3.2", folder: "Policies", tags: ["policy", "employee"], type: "PDF", size: 2.4, updatedAt: "2025-08-20T10:00:00Z", owner: "HR", status: "Active", version: "3.2", url: "#" },
  { id: "D-0002", title: "Offer Letter Template", folder: "Onboarding", tags: ["offer", "template"], type: "DOCX", size: 0.3, updatedAt: "2025-08-22T08:15:00Z", owner: "HR", status: "Active", version: "1.0", url: "#" },
  { id: "D-0003", title: "Salary Increment Letter Template", folder: "Increment/Revision", tags: ["increment", "template"], type: "DOCX", size: 0.25, updatedAt: "2025-08-23T14:30:00Z", owner: "HR", status: "Active", version: "1.1", url: "#" },
  { id: "D-0007", title: "Employee Documents – Sample ID Proof Packet", folder: "Employee Documents", tags: ["employee","id"], type: "PDF", size: 0.5, updatedAt: "2025-08-25T12:00:00Z", owner: "HR", status: "Active", version: "1.0", url: "#" },
  { id: "D-0010", title: "ASF Letterhead (PDF)", folder: "Letterheads", tags: ["letterhead"], type: "PDF", size: 0.2, updatedAt: "2025-08-26T10:45:00Z", owner: "HR", status: "Active", version: "1.0", url: "#" },
  { id: "D-0004", title: "PF & ESI – Compliance Checklist", folder: "Compliance", tags: ["compliance", "PF", "ESI"], type: "PDF", size: 0.9, updatedAt: "2025-08-24T11:00:00Z", owner: "HR", status: "Active", version: "2.1", url: "#" },
  { id: "D-0005", title: "Vendor Agreement – 2025 Template", folder: "Agreements", tags: ["agreement", "vendor"], type: "DOCX", size: 0.6, updatedAt: "2025-08-11T09:30:00Z", owner: "Legal", status: "Active", version: "1.4", url: "#" },
  { id: "D-0006", title: "Exit Kit Template", folder: "Exit", tags: ["exit", "template"], type: "PDF", size: 0.7, updatedAt: "2025-08-10T09:00:00Z", owner: "HR", status: "Active", version: "1.0", url: "#" },
];

const FOLDERS = [
  { key: "All",                 label: "All Documents",                    icon: FileText },
  { key: "Employee Documents",  label: "Employee Documents",               icon: FileText },
  { key: "Onboarding",          label: "Onboarding (Offer/Appointment)",   icon: CheckCircle2 },
  { key: "Increment/Revision",  label: "Increment / Revision",             icon: FileText },
  { key: "Promotion/Transfer",  label: "Promotion / Transfer",             icon: FileText },
  { key: "Exit",                label: "Exit (Relieving/Experience)",      icon: Archive },
  { key: "Policies",            label: "Policies",                         icon: ShieldCheck },
  // NEW: Letterheads tab
  { key: "Letterheads",         label: "Letterheads",                      icon: FileText },
  { key: "Compliance",          label: "Compliance",                       icon: ShieldCheck },
  { key: "Agreements",          label: "Agreements",                       icon: FileText },
  { key: "Other",               label: "Other",                            icon: FileText },
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
  const [docs, setDocs] = useState([]); // start empty; fill from API then fallback
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("All");
  const [view, setView] = useState("grid"); // 'grid' | 'list'
  const [shareDoc, setShareDoc] = useState(null);

  // Load docs from API (fallback to mocks if API not ready)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/documents");
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load documents");
        const rows = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        const mapped = rows.map((r, i) => normalizeDoc(r, i));
        if (!cancelled) setDocs(mapped);
      } catch {
        if (!cancelled) setDocs(MOCK_DOCS);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filtered docs
  const filtered = useMemo(() => {
    let arr = [...docs];
    if (folder !== "All") arr = arr.filter((d) => d.folder === folder);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((d) => [d.title, d.id, d.tags?.join(" "), d.folder].join(" ").toLowerCase().includes(q));
    }
    arr.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return arr;
  }, [docs, folder, query]);

  const openDoc = (doc) => {
    const url = doc?.url || "#";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async (doc) => {
    const direct = doc?.url || (typeof window !== "undefined" ? `${window.location.origin}/share/${doc?.id}` : "");
    if (!direct || direct === "#") {
      setShareDoc(doc);
      return;
    }
    try {
      await navigator.clipboard?.writeText(direct);
      Swal.fire({
        icon: "success",
        title: "Link copied",
        text: "Direct document link copied to clipboard.",
        timer: 1600,
        showConfirmButton: false,
        position: "top-end",
        toast: true,
      });
    } catch {
      setShareDoc(doc);
    }
  };

  const DocCard = ({ d }) => (
    <div className="group rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden cursor-pointer" onClick={() => openDoc(d)}>
      <div className="flex items-start gap-3 p-3">
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
              <button className="p-2 rounded-lg hover:bg-gray-100" title="Share link" onClick={() => handleShare(d)}><Link2 className="h-4 w-4"/></button>
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
                  <button className="p-1.5 rounded-md hover:bg-gray-100" title="Share" onClick={()=>handleShare(d)}><Link2 className="h-4 w-4"/></button>
                </div>
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No documents match your filters.</td></tr>
          )}
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
    const directUrl = doc.url && doc.url !== "#" ? doc.url : (typeof window !== "undefined" ? `${window.location.origin}/share/${doc.id}` : "");
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full sm:max-w-[95vw] md:max-w-xl bg-white border border-gray-200 rounded-2xl shadow-xl p-6 m-0 md:m-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Share document</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><XIcon className="h-5 w-5"/></button>
          </div>
          <div className="text-sm text-gray-700">Direct link to this document.</div>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={directUrl} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"/>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
              onClick={async()=>{
                try { await navigator.clipboard?.writeText(directUrl); Swal.fire({icon:"success", title:"Link copied", timer:1300, showConfirmButton:false, position:"top-end", toast:true}); } catch {}
              }}
            >
              Copy
            </button>
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-3 py-2 text-sm hover:bg-gray-800"
            >
              Open
            </a>
          </div>
        </div>
      </div>
    );
  };

  // Toolbar
  const Toolbar = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <SearchIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, ID, tag..."
          className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>
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
              <p className="text-sm text-gray-600">Centralized repository for HR files.</p>
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
                {view === "grid" ? <GridView /> : <ListView />}
              </div>
            </section>
          </div>
        </div>
      </main>

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
        number: phone,
        company,
        adhaarnumber: String(aadhaar).replace(/\D/g, ""),
        pancard: String(pan).toUpperCase(),
        address: String(address).trim() || null,
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
    <div className="fixed inset-0 z-50 flex items	end md:items-center justify-center" aria-modal="true" role="dialog">
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
