import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [teamTheme, setTeamTheme] = useState({
    primaryColor: "#003399",
    secondaryColor: "#FFFFFF",
  });

  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        backgroundColor: teamTheme.primaryColor,
        backgroundImage: `
          radial-gradient(
            ellipse at 15% 20%,
            ${teamTheme.secondaryColor}45 0%,
            transparent 55%
          ),
          radial-gradient(
            ellipse at 85% 80%,
            ${teamTheme.primaryColor} 0%,
            transparent 65%
          ),
          linear-gradient(
            135deg,
            ${teamTheme.primaryColor} 0%,
            #111827 100%
          )
        `,
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="relative w-[96vw] h-[82vh] flex overflow-hidden rounded-[20px]"
        style={{
          backgroundColor: "#E8E9EC",
          boxShadow: `
            0 24px 70px -20px ${teamTheme.primaryColor}80,
            0 8px 24px -12px rgba(20,30,60,0.18)
          `,
        }}
      >
        {/* Atmósfera abstracta del club */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]"
          style={{ zIndex: 0 }}
        >
          <div
            className="absolute -right-[15%] -top-[35%] h-[90%] w-[65%] rotate-[25deg] opacity-20"
            style={{
              backgroundColor: teamTheme.primaryColor,
            }}
          />

          <div
            className="absolute -bottom-[40%] -left-[15%] h-[90%] w-[65%] -rotate-[25deg] opacity-15"
            style={{
              backgroundColor: teamTheme.secondaryColor,
            }}
          />
        </div>

        {/* Contenido principal */}
        <div className="relative z-10 flex h-full w-full">
          {sidebarVisible &&
            !location.pathname.startsWith("/teams") && (
              <Sidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen((o) => !o)}
                backgroundColor={teamTheme.primaryColor}
                accentColor="#FFFFFF"
                secondaryColor={teamTheme.secondaryColor}
              />
            )}

          <div className="flex-1 flex flex-col min-w-0">
            <TopNavbar />

            <main className="flex-1 overflow-auto">
              <Outlet
                context={{
                  setTeamTheme,
                  setSidebarVisible,
                }}
              />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
