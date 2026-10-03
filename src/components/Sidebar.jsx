import React from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const ALL_PLAYERS_ICON =
  "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg' data-name='Layer 1' viewBox='0 0 24 24'%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M10.09 1.5h3.83a2.87 2.87 0 0 1 2.87 2.87v4.78A4.78 4.78 0 0 1 12 13.93a4.78 4.78 0 0 1-4.78-4.78V4.37a2.87 2.87 0 0 1 2.87-2.87Z'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M7.22 5.33h9.57a2.87 2.87 0 0 1-2.88 2.87h-3.82a2.87 2.87 0 0 1-2.87-2.87ZM3.39 23.5v-1A8.62 8.62 0 0 1 12 13.93a8.62 8.62 0 0 1 8.61 8.61v1'/%3e%3ccircle cx='12' cy='20.63' r='.96' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M12.96 23.5v-2.87m-5.74-6.69L12 19.67l4.78-5.73'/%3e%3c/svg%3e";

const TEAMS_ICON =
  "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg' data-name='Layer 1' viewBox='0 0 24 24'%3e%3ccircle cx='12' cy='3.41' r='1.91' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M9.14 8.18A2.86 2.86 0 0 1 12 5.32a2.86 2.86 0 0 1 2.86 2.86'/%3e%3ccircle cx='19.64' cy='14.86' r='1.91' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M16.77 19.64a2.86 2.86 0 0 1 2.87-2.87 2.86 2.86 0 0 1 2.86 2.87'/%3e%3ccircle cx='4.36' cy='14.86' r='1.91' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M1.5 19.64a2.86 2.86 0 0 1 2.86-2.87 2.86 2.86 0 0 1 2.87 2.87m-4.76-8.27a9.53 9.53 0 0 1 4.91-7.72m9.24 0a9.53 9.53 0 0 1 4.91 7.72M8.39 21.79a9.53 9.53 0 0 0 7.22 0'/%3e%3c/svg%3e";

const COUNTRIES_ICON =
  "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M13.5 6.5h6.206c.428 0 .643 0 .772.09a.5.5 0 0 1 .208.337c.023.156-.073.347-.265.73l-1.252 2.505a1 1 0 0 0-.106.252.5.5 0 0 0-.004.175c.01.066.038.13.094.256l1.347 3.03c.167.375.25.562.223.714a.5.5 0 0 1-.211.325c-.128.086-.333.086-.743.086H12.1c-.56 0-.84 0-1.054-.109a1 1 0 0 1-.437-.437c-.109-.214-.109-.494-.109-1.054V11M3 21V3.5M3 11h8.9c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437c.109-.214.109-.494.109-1.054V4.1c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C3 3.26 3 3.54 3 4.1z'/%3e%3c/svg%3e";

const POSITION_ICON =
  "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg' data-name='Layer 1' viewBox='0 0 24 24'%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M1.5 3.41h21v17.18h-21z'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M18.68 9.14h3.82v5.73h-3.82zm-17.18 0h3.82v5.73H1.5z'/%3e%3ccircle cx='12' cy='12' r='2.86' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='M12 3.41v5.73m0 5.72v5.73'/%3e%3c/svg%3e";

const AGE_ICON =
  "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg' data-name='Layer 1' viewBox='0 0 24 24'%3e%3ccircle cx='11.05' cy='12.95' r='9.55' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3ccircle cx='20.11' cy='3.89' r='2.39' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3cpath fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5' d='m17.73 19.64-1.96-1.96M6.32 8.23 4.36 6.27m1.96 11.41-1.96 1.96M17.73 6.27l-1.96 1.96m-7.59 7.59 5.73-5.73'/%3e%3ccircle cx='11.05' cy='12.95' r='.95' fill='none' stroke='white' stroke-miterlimit='10' stroke-width='1.5'/%3e%3c/svg%3e";

const DESCRIPTION_ICON =
  "data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 24 24'%3e%3cpath d='M15 3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2v2h4a1 1 0 0 1 1 1v3h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2v-2H8v2h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2v-3a1 1 0 0 1 1-1h4V9H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 17H5v2h4zm10 0h-4v2h4zM14 5h-4v2h4z'/%3e%3c/svg%3e";

const VIEW_OPTIONS = [
  {
    id: "all",
    label: "All players",
    icon: ALL_PLAYERS_ICON,
  },
  {
    id: "teams",
    label: "By teams",
    icon: TEAMS_ICON,
  },
  {
    id: "countries",
    label: "By countries",
    icon: COUNTRIES_ICON,
  },
  {
    id: "positions",
    label: "By position",
    icon: POSITION_ICON,
  },
  {
    id: "age",
    label: "By age",
    icon: AGE_ICON,
  },
  {
    id: "description",
    label: "By description",
    icon: DESCRIPTION_ICON,
  },
];

export default function Sidebar({
  open,
  visible = true,
  onToggle,
  backgroundColor = "#133885",
  accentColor = "#FFFFFF",
  secondaryColor = "#FFFFFF",
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isPlayersPage =
    location.pathname === "/players" ||
    location.pathname.startsWith("/players/");

  const rawView = searchParams.get("view");
  const activeView = VIEW_OPTIONS.some((option) => option.id === rawView)
    ? rawView
    : "all";

  const handleViewChange = (view) => {
    navigate({
      pathname: "/players",
      search: view === "all" ? "" : `?view=${view}`,
    });

    // Después de seleccionar una agrupación, cerramos automáticamente el sidebar.
    if (open) {
      onToggle();
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{
        width: visible ? (open ? 220 : 48) : 0,
        opacity: visible ? 1 : 0,
      }}
      transition={{
        width: {
          duration: 0.32,
          ease: [0.4, 0, 0.2, 1],
        },
        opacity: {
          duration: 0.2,
        },
      }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden"
      style={{
        backgroundColor,
        borderRight: `1px solid ${secondaryColor}`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {open && isPlayersPage && (
        <nav
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4"
          aria-label="Player views"
        >
          <div className="flex flex-col items-center gap-4">
            {VIEW_OPTIONS.slice(0, 3).map((option) => {
              const isActive = activeView === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleViewChange(option.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                      : "bg-transparent hover:bg-white/[0.08]"
                  }`}
                  aria-label={option.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <img
                    src={option.icon}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200"
            style={{ color: accentColor }}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center gap-4">
            {VIEW_OPTIONS.slice(3, 6).map((option) => {
              const isActive = activeView === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleViewChange(option.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                      : "bg-transparent hover:bg-white/[0.08]"
                  }`}
                  aria-label={option.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <img
                    src={option.icon}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {!open && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ color: accentColor }}
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
      )}
    </motion.aside>
  );
}
