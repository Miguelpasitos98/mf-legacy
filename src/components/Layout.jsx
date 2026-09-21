
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="min-h-screen w-full px-4 py-4 md:px-6"
      style={{ backgroundColor: "#D1D3D9" }}
    >
      <div className="flex h-[calc(100vh-32px)] w-full flex-col gap-3">
        {/* TopBar compacto */}
        <div
          className="h-14 w-full shrink-0 overflow-hidden rounded-[18px] bg-white"
          style={{
            boxShadow:
              "0 10px 28px -18px rgba(20,30,60,0.28), 0 4px 12px -8px rgba(20,30,60,0.16)",
          }}
        >
          <TopNavbar />
        </div>

        {/* Panel principal */}
        <div
          className="relative flex min-h-0 flex-1 overflow-hidden rounded-[20px]"
          style={{
            backgroundColor: "#E8E9EC",
            boxShadow:
              "0 24px 70px -20px rgba(20,30,60,0.28), 0 8px 24px -12px rgba(20,30,60,0.18)",
          }}
        >
          {/* Sidebar */}
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
          />

          {/* Contenido */}
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
