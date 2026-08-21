import React from "react";
import { ChevronDown } from "lucide-react";

export default function TopNavbar() {
  const footballNav = [
    "SCORES",
    "SCHEDULE",
    "NEWS",
    "STATS",
    "PLAYERS",
    "TEAMS",
  ];

  return (
    <header className="relative flex items-center justify-center h-20 bg-white shrink-0 border-b border-black/5">
      {/* Navegación principal de fútbol */}
      <nav className="flex items-center gap-16">
        {footballNav.map((item) => (
          <button
            key={item}
            className="
              font-heading
              text-[13px]
              font-semibold
              tracking-[0.02em]
              text-[#222222]
              hover:text-[#003399]
              transition-colors
            "
          >
            {item}
          </button>
        ))}
      </nav>

      {/* Perfil / menú de usuario */}
      <div className="absolute right-8 flex items-center gap-3">
        <button
          className="w-9 h-9 rounded-full bg-[#D1D3D9] hover:bg-[#C4C7CE] transition-colors"
          aria-label="Perfil"
        />

        <button
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