import React from "react";
import { ChevronDown } from "lucide-react";

export default function TopNavbar() {
  return (
    <header className="flex items-center justify-between px-6 h-14 bg-white shrink-0 border-b border-black/5">
      <div className="font-heading text-sm font-medium tracking-[0.22em] text-[#333333]">
        MF LEGACY
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#D1D3D9]" />
        <ChevronDown size={14} className="text-[#333333]" />
      </div>
    </header>
  );
}