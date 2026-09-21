
import React from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function Sidebar({
  open,
  onToggle,
  backgroundColor = "#003399",
  accentColor = "#FFFFFF",
}) {
  return (
    <motion.aside
      animate={{ width: open ? 220 : 48 }}
      transition={{
        duration: 0.32,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden"
      style={{
        backgroundColor,
      }}
    >
      <button
        onClick={onToggle}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-colors"
        style={{
          color: accentColor,
        }}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        {open ? <X size={20} /> : <Menu size={18} />}
      </button>
    </motion.aside>
  );
}
