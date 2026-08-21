import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6 md:p-8 lg:p-10"
      style={{ backgroundColor: "#D1D3D9" }}
    >
      <div
        className="relative w-full max-w-[1400px] h-[calc(100vh-3rem)] md:h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] flex overflow-hidden rounded-[20px]"
        style={{
          backgroundColor: "#E8E9EC",
          boxShadow:
            "0 24px 70px -20px rgba(20,30,60,0.28), 0 8px 24px -12px rgba(20,30,60,0.18)",
        }}
      >
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopNavbar />

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}