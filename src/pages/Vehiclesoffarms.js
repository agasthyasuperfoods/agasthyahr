// FILE: src/pages/Vehiclesoffarms.js
import Head from "next/head";
import React from "react";
import MobileFooterMenu from "@/components/MobileFooterMenu";

const MAP_URL = "https://bharatgps.in/sharing/c89a90b003b58157ccdeb3965f84c77b";
const FOOTER_HEIGHT = 64; // px - adjust if your footer height differs

export default function Vehiclesoffarms() {
  return (
    <>
      <Head>
        <title>Vehicles — Map</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen relative bg-gray-50">
        {/* Fullscreen iframe map but reserve bottom space for footer so footer remains clickable */}
        <iframe
          src={MAP_URL}
          title="Vehicles map"
          className="absolute left-0 top-0 w-full border-0"
          style={{
            height: `calc(100vh - ${FOOTER_HEIGHT}px)`, // leave room for footer so it remains clickable
            display: "block",
            zIndex: 0,
          }}
          allowFullScreen
        />

        {/* Accessible fallback for environments that block iframes */}
        <noscript>
          <div className="absolute left-0 top-0 w-full" style={{ height: `calc(100vh - ${FOOTER_HEIGHT}px)` }}>
            <div className="flex items-center justify-center h-full bg-white">
              <p className="text-sm text-gray-700">
                Map could not be loaded. Open{" "}
                <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  the map in a new tab
                </a>
                .
              </p>
            </div>
          </div>
        </noscript>

        {/* Footer: fixed to bottom, above iframe, fully clickable */}
        <div
          className="fixed left-0 right-0 bottom-0 z-50"
          style={{ height: `${FOOTER_HEIGHT}px`, background: "transparent", pointerEvents: "auto" }}
        >
          <MobileFooterMenu />
        </div>
      </div>
    </>
  );
}
