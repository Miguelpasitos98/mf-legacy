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

  const isTeamsPage = location.pathname.startsWith("/teams");

  // PERFIL INDIVIDUAL DE JUGADOR
  const isPlayerProfile =
    location.pathname.startsWith("/players/") ||
    location.pathname.startsWith("/player/");

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center ${
        isPlayerProfile ? "overflow-visible" : "overflow-hidden"
      }`}
      style={{ backgroundColor: "#D1D3D9" }}
    >
      {/* MARCO EXTERIOR */}
      <div
        className={`relative w-[95vw] h-[75vh] rounded-[20px] ${
          isPlayerProfile ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{
          boxShadow:
            "0 24px 70px -20px rgba(20,30,60,0.28), 0 8px 24px -12px rgba(20,30,60,0.18)",
        }}
      >
        {/* CONTENIDO INTERIOR */}
        <div
          className={`relative flex h-full w-full ${
            isPlayerProfile ? "overflow-visible" : "overflow-hidden"
          }`}
          style={{
            backgroundColor: "#E8E9EC",
          }}
        >
          <div
            className={`relative z-10 flex h-full w-full ${
              isPlayerProfile ? "overflow-visible" : "overflow-hidden"
            }`}
          >
            {sidebarVisible && !isTeamsPage && (
              <Sidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen((o) => !o)}
                backgroundColor={teamTheme.primaryColor}
                accentColor="#FFFFFF"
                secondaryColor={teamTheme.secondaryColor}
              />
            )}

            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-visible">
              {/* TOP NAVBAR */}
              <div className="relative z-[100] shrink-0">
                <TopNavbar />
              </div>

              {/* CONTENIDO */}
              <main
                className={
                  isPlayerProfile
                    ? "relative z-0 flex-1 min-h-0 min-w-0 overflow-visible"
                    : isTeamsPage
                      ? "relative z-0 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden"
                      : "relative z-0 flex-1 min-h-0 min-w-0 overflow-visible"
                }
              >
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
    </div>
  );
}
