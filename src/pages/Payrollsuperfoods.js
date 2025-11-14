import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import {
  Building2,
  Download,
  Search,
  Wallet,
  Users2,
  Clock,
  IndianRupee,
} from "lucide-react";
import AdminHeader from "@/components/AdminHeader";

// ---------- Config ----------
const BRAND = "#C1272D";
const BRAND_HOVER = "#a02125";
const SITES = ["ASF", "ASF - Factory", "Both"];
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function Payrollsuperfoods() {
  const [site, setSite] = useState(SITES[0]);
  const [month, setMonth] = useState(defaultMonth());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    try {
      const s = localStorage.getItem("payroll_site");
      const m = localStorage.getItem("payroll_month");
      if (SITES.includes(s)) setSite(s);
      if (m && /^\d{4}-\d{2}$/.test(m)) setMonth(m);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("payroll_site", site);
      localStorage.setItem("payroll_month", month);
    } catch {}
  }, [site, month]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`/api/payroll?site=${encodeURIComponent(site)}&month=${encodeURIComponent(month)}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load");
        const data = Array.isArray(j?.data) ? j.data : [];
        if (!ignore) setRows(normalizeRows(data));
      } catch {
        if (!ignore) {
          setRows(mockRows(site, month));
          setErr("Showing sample data (API unavailable).");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [site, month]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const headcount = filtered.length;
    const presentDays = filtered.reduce((a, r) => a + (r.presentDays || 0), 0);
    const otHours = filtered.reduce((a, r) => a + (r.otHours || 0), 0);
    const gross = filtered.reduce((a, r) => a + (r.gross || 0), 0);
    const deductions = filtered.reduce((a, r) => a + (r.deductions || 0), 0);
    const net = filtered.reduce((a, r) => a + (r.net || 0), 0);
    return { headcount, presentDays, otHours, gross, deductions, net };
  }, [filtered]);

  const exportExcel = async () => {
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;

    const data = filtered.map(r => ({
      "Employee ID": r.id,
      "Name": r.name,
      "Present Days": r.presentDays ?? 0,
      "Leave Days": r.leaveDays ?? 0,
      "OT Hours": r.otHours ?? 0,
      "Gross": r.gross ?? 0,
      "Deductions": r.deductions ?? 0,
      "Net": r.net ?? ((r.gross ?? 0) - (r.deductions ?? 0)),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${site.replace(/\s+/g, "_")}_${month}_payroll.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Head>
        <title>Payroll • {site}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <AdminHeader />

      <main className="min-h-screen bg-gray-50 px-4 py-4">
        {/* Header */}
        <div className="mx-auto max-w-7xl mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-500" />
              <h1 className="text-lg font-semibold text-gray-900">Payroll</h1>
              <span className="text-gray-300">/</span>
              <span className="text-gray-800">{site}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SitePill site="ASF" active={site === "ASF"} onClick={() => setSite("ASF")} />
              <SitePill site="ASF - Factory" active={site === "ASF - Factory"} onClick={() => setSite("ASF - Factory")} />
              <SitePill site="Both" active={site === "Both"} onClick={() => setSite("Both")} />

              <div className="flex items-center gap-2 ml-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none "
                  />
                </label>

                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    placeholder="Search ID or name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 pr-2 py-1 rounded-md border border-gray-300 text-sm w-48 focus:outline-none "
                  />
                </div>

                <button
                  onClick={exportExcel}
                  className="inline-flex items-center gap-2 rounded-md text-white text-sm px-3 py-1.5 transition-colors"
                  style={{ background: BRAND }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = BRAND_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = BRAND)}
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <KPI icon={<Users2 className="h-5 w-5 text-gray-500" />} label="Headcount" value={totals.headcount} />
          <KPI icon={<Clock className="h-5 w-5 text-gray-500" />} label="OT Hours" value={totals.otHours} />
          <KPI icon={<Wallet className="h-5 w-5 text-gray-500" />} label="Gross" value={INR.format(totals.gross)} />
          <KPI icon={<IndianRupee className="h-5 w-5 text-gray-500" />} label="Net" value={INR.format(totals.net)} />
        </div>

        {/* Table */}
        <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <Th>Employee ID</Th>
                  <Th>Name</Th>
                  <Th className="text-right">Present</Th>
                  <Th className="text-right">Leave</Th>
                  <Th className="text-right">OT (hrs)</Th>
                  <Th className="text-right">Gross</Th>
                  <Th className="text-right">Deductions</Th>
                  <Th className="text-right">Net</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500">Loading…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500">No data</td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id + r.name} className="hover:bg-gray-50">
                      <Td>{r.id}</Td>
                      <Td className="font-medium text-gray-900">{r.name}</Td>
                      <Td className="text-right">{r.presentDays}</Td>
                      <Td className="text-right">{r.leaveDays}</Td>
                      <Td className="text-right">{r.otHours}</Td>
                      <Td className="text-right">{INR.format(r.gross)}</Td>
                      <Td className="text-right">{INR.format(r.deductions)}</Td>
                      <Td className="text-right font-medium text-gray-900">{INR.format(r.net)}</Td>
                    </tr>
                  ))
                )}
              </tbody>

              {!loading && filtered.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <Td className="font-semibold text-gray-900" colSpan={2}>Totals</Td>
                    <Td className="text-right font-semibold text-gray-900">{totals.presentDays}</Td>
                    <Td className="text-right font-semibold text-gray-900">
                      {filtered.reduce((a, r) => a + (r.leaveDays || 0), 0)}
                    </Td>
                    <Td className="text-right font-semibold text-gray-900">{totals.otHours}</Td>
                    <Td className="text-right font-semibold text-gray-900">{INR.format(totals.gross)}</Td>
                    <Td className="text-right font-semibold text-gray-900">{INR.format(totals.deductions)}</Td>
                    <Td className="text-right font-semibold text-gray-900">{INR.format(totals.net)}</Td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {err ? <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">{err}</div> : null}
        </div>
      </main>
    </>
  );
}

// ---------- UI bits ----------
function KPI({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3">
      <div className="flex items-center justify-between">
        <div>{icon}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
      <div className="mt-2 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function SitePill({ site, active, onClick }) {
  // Pleasant neutral pills; active = slightly filled gray
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? "bg-gray-100 text-gray-900 border-gray-300"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      } focus:outline-none `}
    >
      {site}
    </button>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "", ...rest }) {
  return <td className={`px-3 py-2 text-gray-700 ${className}`} {...rest}>{children}</td>;
}

// ---------- Helpers ----------
function defaultMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeRows(data) {
  return data.map((r) => ({
    id: String(r.id || r.employeeid || "").toUpperCase(),
    name: String(r.name || ""),
    presentDays: Number(r.presentDays ?? r.present_days ?? 0),
    leaveDays: Number(r.leaveDays ?? r.leave_days ?? 0),
    otHours: Number(r.otHours ?? r.ot_hours ?? 0),
    gross: Number(r.gross ?? 0),
    deductions: Number(r.deductions ?? 0),
    net: Number(r.net ?? (Number(r.gross ?? 0) - Number(r.deductions ?? 0))),
  }));
}

function mockRows(site, month) {
  const make = (label) => {
    const names = label === "ASF"
      ? ["Anita", "Bharath", "Chitra", "Deepak", "Esha", "Farhan"]
      : ["Gauri", "Harish", "Iqbal", "Jaya", "Kiran", "Lakshmi"];
    return names.map((n, i) => {
      const present = 26 - (i % 3);
      const leave = 2 + (i % 3);
      const ot = (i % 4) * 3;
      const gross = 30000 + i * 1200 + (label === "ASF - Factory" ? 2500 : 0);
      const deductions = 1200 + (i % 2) * 300;
      return {
        id: `EMP${1000 + i + (label === "ASF" ? 0 : 50)}`,
        name: n,
        presentDays: present,
        leaveDays: leave,
        otHours: ot,
        gross,
        deductions,
        net: gross - deductions,
      };
    });
  };

  if (site === "Both") {
    return [...make("ASF"), ...make("ASF - Factory")];
  }
  return make(site);
}
