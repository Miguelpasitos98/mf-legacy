import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const parseRoles = raw => {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// Prioridades por posición del ADN táctico del entrenador elegido.
export default function useManagerRoleProfile(managerId) {
  const [roleText, setRoleText] = useState({});
  useEffect(() => {
    setRoleText({});
    if (!managerId) return;
    let live = true;
    base44.entities.ManagerTacticalProfile
      .filter({ manager_id: String(managerId) }, { limit: 20 })
      .then(result => {
        if (!live) return;
        const rows = Array.isArray(result) ? result : result?.items || result?.data || [];
        const profile = rows.find(row => row.is_default) || rows[0];
        setRoleText(parseRoles(profile?.player_role_priorities));
      })
      .catch(() => { if (live) setRoleText({}); });
    return () => { live = false; };
  }, [managerId]);
  return roleText;
}