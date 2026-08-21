import React from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function Sidebar({ open, onToggle }) {
  return (
    <motion.aside
      animate={{ width: open ? 240 : 64 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full overflow-hidden shrink-0"
      style={{ backgroundColor: "#003399" }}
    >
      <button
        onClick={onToggle}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-white/90 hover:text-white transition-colors"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
    </motion.aside>
  );
}