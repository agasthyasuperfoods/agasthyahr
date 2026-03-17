import Head from "next/head";
import React from "react";
import AdminHeader from "@/components/AccountHeadernutromilk";
import Nutromilkvehicles from "@/components/Nutromilkvehicles";

export default function NVehicles() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Head>
        <title>Vehicle Tracking | Agasthya</title>
      </Head>

      <AdminHeader />

      <main className="flex-1 relative">
        <Nutromilkvehicles />
      </main>

      <style jsx global>{`
        html,
        body,
        #__next {
          height: 100%;
          margin: 0;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
