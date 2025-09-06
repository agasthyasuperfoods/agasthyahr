// src/pages/Organizationchart.js
import React, { useMemo, useState } from "react";
import Head from "next/head";
import AppHeader from "@/components/AppHeader";

/** === Minimal data model (derived from the uploaded org chart) ===
 * Tip: add/remove people or whole sections below and the UI updates automatically.
 */
const DATA = {
  company: "Agasthya Superfoods India",
  site: "Narmala",
  updated: "April 2025",
  chairman: { name: "Mr. Indu Mouli", role: "Chairman" },
  managingDirector: { name: "Mr. Charan Vadavala", role: "Managing Director" },
  functionalHeads: [
    { name: "Mr. Ganesh Uppala", role: "President – Operations", dept: "Operations" },
    { name: "Mr. Amar Nath", role: "General Manager", dept: "Operations" },
    { name: "Mr. Ramanjneyulu", role: "Finance Manager", dept: "Finance" },
    { name: "Mr. Anil Kumar", role: "Asst. General Manager – HR (Operations)", dept: "HR" },
    { name: "Mr. Seshu Bandaru", role: "Chief Information Officer", dept: "IT" },
    { name: "Mr. Satyanandam Iruku", role: "Plant Head", dept: "Plant" },
    // Sales group is multi-head in the source
    { name: "Ms. Manvitha Reddy Nare", role: "Sales Manager", dept: "Sales" },
    { name: "Mr. Tribhuvan Dev G", role: "Sales Manager", dept: "Sales" },
    { name: "Mr. Raghunath B G", role: "Sales Manager", dept: "Sales" },
    { name: "Mr. Naveen Chandra Pavan", role: "Sales Manager", dept: "Sales" },
  ],

  // Department rollups (sampled/condensed from PDF; extend freely)
  departments: [
    {
      key: "Production",
      head: { name: "Mr. Raghuma Reddy Maram", role: "Production Manager" },
      teams: [
        { name: "Production Executives", members: ["Mr. Niteesh Gowd M", "Mr. Rathan Oruganti"] },
        { name: "Batch Weighing", members: ["Mr. Venkatesh M", "Shift A: Mr. Sharavan, Mr. Naveen", "Shift B: Mr. Chandram J"] },
        { name: "Extruder", lead: "A. Balaraju (Extruder Manager)", members: ["Shift A: Mr. Prasanth B", "Shift B: Mr. Chinnam Naidu", "Mr. Anjani Kumar Maurya"] },
        { name: "Milling", members: ["Mr. Mallesham O", "VACANT (1)"] },
      ],
      vacancies: [{ title: "Milling Manager", count: 1 }],
    },
    {
      key: "Quality",
      head: { name: "Mr. Pavan Kumar Singaraju", role: "Quality Manager" },
      teams: [
        { name: "Quality Executives", members: ["Mr. Vijendhar", "Mr. Satanarayana", "Mr. Mandula Manisai", "Mr. Pavan Kalyan Banda (10 Mar 2025)"] },
        { name: "Additional QE (Line)", members: ["Shift A: Mr. Satyanarayana J", "Shift B: Mr. Sreehari Thenmatam (10 Mar 2025)"] },
      ],
    },
    {
      key: "Maintenance",
      head: { name: "Mr. Manikanta Neeli", role: "Maintenance Manager" },
      teams: [
        { name: "Maintenance Engineer", members: ["Ch. Venkatesh"] },
        { name: "External Maintenance & Supervisor", members: ["Mr. Shyam CH"] },
        { name: "Maintenance Executives", members: ["Mr. Mahendar CH", "R. Issak", "S. Raju"] },
      ],
    },
    {
      key: "Procurement & Logistics",
      head: { name: "Mr. Dileep K", role: "Head – Procurement & Logistics" },
      teams: [
        { name: "Stores & Purchases", members: ["Mr. Nagendar G", "Mr. Pavan Kalyan"] },
      ],
    },
    {
      key: "R&D",
      head: { name: "VACANT", role: "R&D" },
      vacancies: [{ title: "R&D", count: 1 }],
    },
    {
      key: "Finance",
      head: { name: "Mr. Ramanjneyulu", role: "Finance Manager" },
      teams: [
        { name: "Accounts", members: ["Mr. Thimothy (Accounts Executive)", "Mr. Nikhil Boga (Accounts Officer)"] },
      ],
    },
    {
      key: "HR",
      head: { name: "Mr. Anil Kumar", role: "AGM – HR (Operations)" },
      teams: [
        { name: "HR & Admin", members: ["Mr. Venu Madas"] },
        { name: "Housekeeping", members: ["Supervisor: V. Dharma Reddy", "Staff: Female (7), Male (3)"] },
        { name: "Gardening", members: ["Mr. D. Narasimha (Gardener)"] },
      ],
    },
    {
      key: "IT",
      head: { name: "Mr. Seshu Bandaru", role: "CIO" },
      teams: [{ name: "IT Support", members: ["Mrs. Anusha Pakala (IT – Trainee)"] }],
    },
    {
      key: "Sales",
      head: { name: "—", role: "Sales Leadership Team" },
      teams: [
        { name: "Managers", members: ["Ms. Manvitha Reddy Nare", "Mr. Tribhuvan Dev G", "Mr. Raghunath B G", "Mr. Naveen Chandra Pavan"] },
        { name: "Field", members: ["Mr. Pavan Kalyan Patibandla (Sales Executive)"] },
      ],
    },
    {
      key: "Packing & Line Ops",
      head: { name: "—", role: "Line Supervisors" },
      teams: [
        { name: "Packing", members: ["Mr. Pradeep Yadav", "Mr. Arjuna Dakua", "Mr. Raj Kumar Kushwaha", "Mr. Pradhan Mayadhar"] },
        { name: "Packing Operator", members: ["Shift A: Mr. Amrish", "Shift B: Mr. Pradhan Mayadhar"] },
        { name: "Support (selected)", members: ["Drum Coating (2 shifts)", "Hopper Feeding (2 shifts)", "Mono Carton Filling (2 shifts)", "Collection (2 shifts)"] },
        { name: "Vacancies (sample)", members: ["VFFS / Semi Auto (2)", "Line Helper (2)", "Sorting (4)", "Packing Line Helper (2)", "Box Packing (8)", "Weighing (2)"] },
      ],
    },
  ],
};

/** === Small helpers === */
function cn(...a) { return a.filter(Boolean).join(" "); }
function Badge({ children }) {
  return <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">{children}</span>;
}
function Card({ title, subtitle, children, tone = "default" }) {
  const toneCls =
    tone === "head" ? "border-gray-900" :
    tone === "vacant" ? "border-amber-300 bg-amber-50" :
    "border-gray-200";
  return (
    <div className={cn("rounded-2xl border bg-white shadow-sm p-3", toneCls)}>
      <div className="mb-1">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {subtitle ? <div className="text-xs text-gray-600">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** === Hierarchy view (very simple “levels” layout) === */
function Hierarchy({ data }) {
  const heads = data.functionalHeads;

  return (
    <div className="space-y-6">
      {/* Level 1 */}
      <div className="flex justify-center">
        <Card title={data.chairman.name} subtitle={data.chairman.role} tone="head" />
      </div>

      {/* Connector */}
      <div className="flex justify-center">
        <div className="h-6 w-0.5 bg-gray-300" />
      </div>

      {/* Level 2 */}
      <div className="flex justify-center">
        <Card title={data.managingDirector.name} subtitle={data.managingDirector.role} tone="head" />
      </div>

      {/* Connector */}
      <div className="flex justify-center">
        <div className="h-6 w-0.5 bg-gray-300" />
      </div>

      {/* Level 3: Functional Heads in a grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {heads.map((h, i) => (
          <Card key={i} title={h.name} subtitle={h.role + (h.dept ? ` • ${h.dept}` : "")} />
        ))}
      </div>
    </div>
  );
}

/** === Department view (search + cards) === */
function DepartmentView({ data }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!ql) return data.departments;
    return data.departments
      .map((d) => {
        const hitDept =
          d.key.toLowerCase().includes(ql) ||
          (d.head?.name || "").toLowerCase().includes(ql) ||
          (d.head?.role || "").toLowerCase().includes(ql);
        const teams = (d.teams || []).map((t) => ({
          ...t,
          members: (t.members || []).filter((m) => m.toLowerCase().includes(ql)),
        })).filter((t) => t.members?.length || t.name.toLowerCase().includes(ql));

        const vacancies = (d.vacancies || []).filter(
          (v) => v.title.toLowerCase().includes(ql)
        );

        if (hitDept || teams.length || vacancies.length) {
          return { ...d, teams, vacancies };
        }
        return null;
      })
      .filter(Boolean);
  }, [data.departments, ql]);

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm mb-4">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by department, role, or name…"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          {q ? (
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => setQ("")}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((dept) => (
          <Card
            key={dept.key}
            title={dept.key}
            subtitle={dept.head ? `${dept.head.name} • ${dept.head.role}` : ""}
          >
            <div className="space-y-3 mt-2">
              {(dept.teams || []).map((t, idx) => (
                <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900">{t.name}</div>
                    {dept.key === "Production" && idx === 2 && t.lead ? (
                      <Badge>{t.lead}</Badge>
                    ) : null}
                  </div>
                  {t.members?.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
                      {t.members.map((m, i2) => <li key={i2}>{m}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
              {(dept.vacancies || []).length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-sm font-semibold text-amber-800 mb-1">Vacancies</div>
                  <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
                    {dept.vacancies.map((v, i3) => (
                      <li key={i3}>
                        {v.title} {typeof v.count === "number" ? `(No: ${v.count})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function OrganizationChartPage() {
  const [view, setView] = useState("dept"); // "dept" | "hier"

  return (
    <>
      <Head>
        <title>Organization Chart • {DATA.company}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <AppHeader currentPath="/Organizationchart" hrName="HR" />

        <div className="p-4 md:p-6 space-y-5">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                Organization Chart
              </h1>
              <p className="text-sm text-gray-600">
                {DATA.company} • {DATA.site} • <span className="font-medium">{DATA.updated}</span>
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-1">
              <button
                onClick={() => setView("dept")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg",
                  view === "dept" ? "bg-gray-900 text-white" : "hover:bg-gray-50"
                )}
              >
                Department View
              </button>
              <button
                onClick={() => setView("hier")}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg",
                  view === "hier" ? "bg-gray-900 text-white" : "hover:bg-gray-50"
                )}
              >
                Hierarchy View
              </button>
            </div>
          </div>

          {/* Views */}
          {view === "hier" ? (
            <Hierarchy data={DATA} />
          ) : (
            <DepartmentView data={DATA} />
          )}

          {/* Footnote */}
          <div className="text-xs text-gray-500">
            Notes: Some sections condensed for readability. Vacancies indicated where specified.
          </div>
        </div>
      </main>
    </>
  );
}
