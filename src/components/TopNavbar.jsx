
import React from "react";
import { ChevronDown } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function TopNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const footballNav = [
    { label: "SCORES", path: "/scores" },
    { label: "SCHEDULE", path: "/schedule" },
    { label: "NEWS", path: "/news" },
    { label: "STATS", path: "/stats" },
    { label: "PLAYERS", path: "/players" },
    { label: "TEAMS", path: "/teams" },
    { label: "COUNTRIES", path: "/countries" },
  ];

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-center border-b border-black/5 bg-white">
      {/* Navegación principal de fútbol */}
      <nav className="flex items-center gap-10">
        {footballNav.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === "/countries" &&
              location.pathname.startsWith("/countries/"));

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              className={`
                font-heading
                text-[13px]
                font-semibold
                tracking-[0.02em]
                transition-colors
                ${
                  isActive
                    ? "text-[#003399]"
                    : "text-[#222222] hover:text-[#003399]"
                }
              `}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Perfil / menú de usuario */}
      <div className="absolute right-8 flex items-center gap-3">
        <button
          type="button"
          className="h-9 w-9 rounded-full bg-[#D1D3D9] transition-colors hover:bg-[#C4C7CE]"
          aria-label="Perfil"
        />

        <button
          type="button"
          className="flex items-center justify-center"
          aria-label="Abrir menú de usuario"
        >
          <ChevronDown
            size={15}
            strokeWidth={1.8}
            className="text-[#333333]"
          />
        </button>
      </div>
    </header>
  );
}
