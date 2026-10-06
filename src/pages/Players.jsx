import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  CalendarDays,
  Building2,
  Globe2,
  ChevronDown,
} from "lucide-react";
import PlayersDetail from "@/pages/PlayerDetail";
import { useLocation, useSearchParams } from "react-router-dom";
import { parseFootballManagerCsv } from "@/utils/playerCsvImporter";

import { base44 } from "@/api/base44Client";



const PLAYER_DESCRIPTIONS = [
  {
    group: "Goalkeepers",
    options: [
      "🧤 Traditional Goalkeeper",
      "🕹️ Modern Goalkeeper",
      "🧱 Positional Goalkeeper",
      "🚀 Sweeper Distributor",
      "🪟 Sweeper Keeper",
      "🪞 Penalty Specialist",
      "🔁 Reliable Backup Keeper",
    ],
  },
  {
    group: "Centre-Backs",
    options: [
      "🧱 The Sweeper",
      "🧠 Ball-Playing Defender",
      "🦍 Physical Dominator",
      "🛡️ Aggressive Front-Foot Defender",
      "🧲 Libero Defender",
      "📐 Tactical Defender",
      "👑 Defensive Leader",
      "🧬 Hybrid Defender",
    ],
  },
  {
    group: "Full-Backs / Wing-Backs",
    options: [
      "🚪 Defensive Full-Back",
      "🛞 Overlapping Wing-Back",
      "🌀 Complete Full-Back",
      "🧩 Versatile Full-Back",
      "🪫 Defensive Wing-Back",
      "⚡ Explosive Full-Back",
      "🪙 Technical Full-Back",
      "🏗️ Inverted Full-Back",
    ],
  },
  {
    group: "Central Midfielders",
    options: [
      "⚓ The Anchorman",
      "💥 The Destroyer",
      "🧭 Regista",
      "🔄 Box-to-Box Controller",
      "🧠 Advanced Playmaker",
      "📡 Deep-Lying Playmaker",
      "🧯 Firefighter Midfielder",
      "🧮 Methodical Midfielder",
      "🛠️ Workhorse Midfielder",
    ],
  },
  {
    group: "Attacking Midfielders",
    options: [
      "🎨 The Architect",
      "🎩 Space Creator",
      "🧃 The Classic 10",
      "🔁 The Connector",
      "🧱 Physical Playmaker",
      "🪛 Pressing Midfielder",
      "🎬 Late Runner",
      "🧲 Gravitational Playmaker",
      "🛠️ Physical Creator",
    ],
  },
  {
    group: "Wingers",
    options: [
      "⚡ Line Breaker",
      "🔁 Wide Connector",
