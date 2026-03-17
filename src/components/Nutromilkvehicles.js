import React from "react";

const MAP_URL = "https://bharatgps.in/sharing/c89a90b003b58157ccdeb3965f84c77b";

export default function Nutromilkvehicles() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-100">
      {/* 1. The Map (Full Screen) */}
      <div className="absolute inset-0" style={{ marginBottom: "-38px" }}>
        <iframe
          src={MAP_URL}
          title="Live Tracking"
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>

      {/* 2. Floating Status Card (The only "True" data) */}
      <div className="absolute top-6 left-6 z-10">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 min-w-[240px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Live Fleet
            </span>
          </div>
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">
              2 Vehicles
            </h2>
            <p className="text-xs text-gray-500 font-medium tracking-tight">
              Active in Tandur Sector
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-[#D23338] hover:bg-[#b52a2f] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-red-100"
          >
            Refresh Map
          </button>
        </div>
      </div>
    </div>
  );
}
