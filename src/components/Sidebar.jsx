import React from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function Sidebar({ open, onToggle }) {
  return (
    <motion.aside
      animate={{ width: open ? 240 : 64 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col items-start justify-center h-full overflow-hidden shrink-0"
      style={{ backgroundColor: "#003399" }}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-3 px-5 text-white/90 hover:text-white transition-colors"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
    </motion.aside>
  );
}