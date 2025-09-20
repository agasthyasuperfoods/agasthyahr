/* ===========================
   ANM Preview Modal (Tandur / Thalakondapallya)
   Matches DB columns: SI, name, date, status
   Sorted by SI (ascending) always
   Full list is scrollable (no rows cut off)
   =========================== */
function AnmPreviewDailyModal({ site, date, onClose, onSaved }) {
  const siteLabel = site === "tandur" ? "Tandur" : "Thalakondapallya";

  const [data, setData] = useState([]);   // [{ si, name, status, date }]
  const [orig, setOrig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const normalizeRow = (row) => ({
    si: Number(row?.si ?? row?.SI ?? 0) || 0,
    name: String(row?.name || ""),
    status: String(row?.status || ""),
    date: String(row?.date || ""), // yyyy-mm-dd
  });

  // numeric sort by SI
  const bySiAsc = useCallback((a, b) => (a.si || 0) - (b.si || 0), []);

  const toHumanDateDdMmYyyyLocal = (yyyyMmDd) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || "")) return "-";
    const [y, m, d] = yyyyMmDd.split("-");
    return `${d}/${m}/${y}`;
  };

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(
        `/api/attendance/anm/daily?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to fetch ANM attendance");

      const rows = Array.isArray(j?.rows) ? j.rows.map(normalizeRow) : [];
      rows.sort(bySiAsc); // ✅ always ordered 1,2,3...
      setData(rows);
      setOrig(rows);
    } catch (e) {
      setData([]);
      setOrig([]);
      Swal.fire({ icon: "error", title: "Load error", text: e.message || "Could not fetch data" });
    } finally {
      setLoading(false);
    }
  }, [site, date, bySiAsc]);

  useEffect(() => { reload(); }, [reload]);

  // Search + keep order by SI even when filtered
  const viewRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? [...data]
      : data.filter((r) =>
          [r.name, r.status, String(r.si), r.date].some((v) =>
            String(v || "").toLowerCase().includes(q)
          )
        );
    return list.sort(bySiAsc);
  }, [data, search, bySiAsc]);

  // Counts (on filtered/sorted view)
  const counts = useMemo(() => {
    const norm = (s) => String(s || "").trim().toLowerCase();
    let present = 0, absent = 0, leave = 0, other = 0;
    for (const r of viewRows) {
      const s = norm(r.status);
      if (["p", "present"].includes(s)) present++;
      else if (["a", "absent"].includes(s)) absent++;
      else if (["l", "leave"].includes(s)) leave++;
      else other++;
    }
    return { total: viewRows.length, present, absent, leave, other };
  }, [viewRows]);

  // Changed rows (only name/status matter for saving)
  const changedRows = useMemo(() => {
    const bySi = new Map(orig.map((o) => [o.si, o]));
    return data.filter((r) => {
      const o = bySi.get(r.si);
      if (!o) return false;
      return o.name !== r.name || o.status !== r.status;
    });
  }, [data, orig]);

  const total = data.length;
  const shown = viewRows.length;

  const updateCell = (i, key, val) => {
    setData((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: val };
      // si doesn’t change; order preserved. If you ever allow SI edits, re-sort here.
      return next;
    });
  };

  // Submit: allow even with zero edits
  const submit = async () => {
    try {
      setSaving(true);

      if (changedRows.length === 0) {
        await Swal.fire({
          icon: "success",
          title: "Submitted",
          text: "No edits detected. Data is already up to date.",
          confirmButtonColor: "#C1272D",
        });
        onSaved?.({ saved: 0, submitted: true });
        onClose?.();
        return;
      }

      for (const r of changedRows) {
        const res = await fetch(`/api/attendance/anm/row?site=${encodeURIComponent(site)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ si: r.si, name: r.name, status: r.status }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || `Failed to update SI ${r.si}`);
      }

      const snap = [...data].sort(bySiAsc);
      setOrig(snap);
      setData(snap);

      await Swal.fire({
        icon: "success",
        title: "Submitted",
        text: `Updated ${changedRows.length} ${changedRows.length === 1 ? "row" : "rows"}.`,
        confirmButtonColor: "#C1272D",
      });
      onSaved?.({ saved: changedRows.length, submitted: true });
      onClose?.();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Submit failed", text: e.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (si) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: `Delete row #${si}?`,
      text: "This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/attendance/anm/row?site=${encodeURIComponent(site)}&si=${encodeURIComponent(si)}`,
        { method: "DELETE" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");

      setData((prev) => prev.filter((r) => r.si !== si));
      setOrig((prev) => prev.filter((r) => r.si !== si));
      Swal.fire({ icon: "success", title: "Deleted", text: `Row #${si} removed.` });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Delete failed", text: e.message || "Something went wrong" });
    }
  };

  // Close with unsaved check
  const isDirty = useMemo(() => changedRows.length > 0, [changedRows]);
  const handleClose = async () => {
    if (!isDirty) return onClose?.();
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Discard changes?",
      text: "You have unsaved edits. Close without submitting?",
      showCancelButton: true,
      confirmButtonText: "Discard",
      cancelButtonText: "Stay",
      confirmButtonColor: "#C1272D",
    }).then((r) => r.isConfirmed);
    if (confirm) onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />

      {/* 🔧 Modal content: fixed height & internal scrolling */}
      <div className="relative w-full md:max-w-5xl bg-white border border-gray-200 rounded-t-2xl md:rounded-2xl shadow-xl m-0 md:m-4 h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {siteLabel} • {toHumanDateDdMmYyyyLocal(date)}
            </h3>
            <div className="mt-1 text-xs text-gray-600">
              {loading ? "Loading…" : <>Showing {shown} of {total} employees</>}
            </div>
            {!loading && (
              <div className="mt-1 text-xs text-gray-700">
                <span className="mr-3">Total: <span className="font-semibold">{counts.total}</span></span>
                <span className="mr-3">Present: <span className="font-semibold text-emerald-700">{counts.present}</span></span>
                <span className="mr-3">Absent: <span className="font-semibold text-red-600">{counts.absent}</span></span>
                <span className="mr-3">Leave: <span className="font-semibold text-amber-600">{counts.leave}</span></span>
                <span>Other: <span className="font-semibold text-gray-600">{counts.other}</span></span>
              </div>
            )}
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" title="Close">✕</button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 w-full md:max-w-2xl">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Search by SI, name, date, or status…"
              disabled={loading}
            />
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body (scrolls) */}
        <div className="px-6 flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="py-8 text-center text-gray-600">
              <span className="inline-block h-5 w-5 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
              Loading attendance…
            </div>
          ) : !data?.length ? (
            <div className="py-8 text-center text-gray-600">
              No rows found for {siteLabel} on {toHumanDateDdMmYyyyLocal(date)}.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl flex-1 min-h-0">
              <div className="h-full overflow-y-auto">
                <table className="min-w-[880px] w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2 border-b w-24">SI</th>
                      <th className="px-3 py-2 border-b">test</th>
                      <th className="px-3 py-2 border-b w-40">Date</th>
                      <th className="px-3 py-2 border-b w-56">Status</th>
                      <th className="px-3 py-2 border-b w-32 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRows.map((r) => {
                      const idx = data.findIndex((x) => x.si === r.si);
                      return (
                        <tr key={r.si} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2 border-t align-top">{r.si}</td>
                          <td className="px-3 py-2 border-t align-top">
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => updateCell(idx, "name", e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1"
                              placeholder="Name"
                            />
                          </td>
                          <td className="px-3 py-2 border-t align-top">
                            <span className="inline-block px-2 py-1 rounded border border-gray-200 bg-gray-50">
                              {toHumanDateDdMmYyyyLocal(r.date)}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-t align-top">
                            <input
                              type="text"
                              value={r.status}
                              onChange={(e) => updateCell(idx, "status", e.target.value)}
                              className="w-full rounded border border-gray-300 px-2 py-1"
                              placeholder="Status (Present/Absent/Leave)"
                            />
                          </td>
                          <td className="px-3 py-2 border-t align-top text-right">
                            <button
                              onClick={() => onDelete(r.si)}
                              className="p-2 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                              title="Delete row"
                              aria-label="Delete row"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-6 flex items-center justify-end gap-3 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
            <button
              type="button"
              onClick={submit}
              disabled={loading || saving}
              className="inline-flex items-center rounded-lg bg-[#C1272D] px-4 py-2 text-sm font-medium text-white hover:bg-[#a02125] disabled:opacity-60"
            >
              {saving ? "Submitting…" : "Submit"}
            </button>
        </div>
      </div>
    </div>
  );
}
