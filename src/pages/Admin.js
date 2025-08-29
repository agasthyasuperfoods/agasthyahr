// src/pages/Admin.js
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import AdminHeader from "@/components/AdminHeader";
import UsersTable from "@/components/UsersTable";

export default function Admin() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [adminName, setAdminName] = useState("Admin");

  // Require auth; seed greeting name from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = localStorage.getItem("auth") === "1";
    if (!ok) {
      router.replace("/Alogin");
      return;
    }
    const n = localStorage.getItem("adminName");
    if (n) setAdminName(n);
    setReady(true);
  }, [router]);

  // Resolve real name from the DB using stored employee ID
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const empId = localStorage.getItem("adminEmployeeId");
    if (!empId) return;

    (async () => {
      try {
        const res = await fetch(`/api/admin/profile?identifier=${encodeURIComponent(empId)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.data?.name) {
          setAdminName(j.data.name);
          localStorage.setItem("adminName", j.data.name);
        }
      } catch {
        // ignore; fallback stays
      }
    })();
  }, [ready]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const onProfileClick = () => router.push("/Admin/profile");
  const onLogout = () => {
    try {
      localStorage.removeItem("auth");
      localStorage.removeItem("remember");
    } catch {}
    router.replace("/Alogin");
  };

  if (!ready) {
    return (
      <>
        <Head><title>Admin • Agasthya Super Foods</title></Head>
        <div className="min-h-screen grid place-items-center bg-gray-50">
          <div className="inline-flex items-center text-gray-600">
            <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            Loading…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin • Agasthya Super Foods</title>
        <meta name="robots" content="noindex" />
      </Head>

      <AdminHeader
        currentPath={router.pathname}
        adminName={adminName}
        onProfileClick={onProfileClick}
        onLogout={onLogout}
      />

      <main className="min-h-[calc(100vh-57px)] bg-gray-50">
        <div className="mx-auto px-4 py-6 space-y-6">
          {/* Hero */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <h1 className="text-xl font-semibold text-gray-900">
              {greeting}{adminName ? `, ${adminName}` : ""} 👋
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage users, attendance, payroll, and reports from one place.
            </p>
          </section>

          {/* Employees (anchor target for header link) */}
          <section id="users-card" className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 md:p-6">
            <UsersTable />
          </section>
        </div>
      </main>
    </>
  );
}
