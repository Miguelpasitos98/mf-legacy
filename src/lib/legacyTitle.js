const SPECIAL_LEGACY_TITLES = {
  "Kylian Mbappé": "🐢 La Tortuga",
  "Neymar Jr": "🪄 O Magico",
  "Cristiano Ronaldo": "🐞 El Bicho",
  "Erling Haaland": "🤖 The Cyborg",
  "Luis Suárez": "🔫 El Pistolero",
  "Pedri": "🪄 El Mago",
  "Antoine Griezman": "👑 El Principito",
  "Lionel Messi": "🛐 D10S",
  "Thibaut Courtois": "🧱 The Belgian Wall",
  "Frenkie de Jong": "🎩 El Filósofo",
  "Paulo Dybala": "💎 La Joya",
  "José Morales": "🪖 Comandante Morales",
  "Ferran Torres": "🦈 El Tiburón",
  "Franco Vázquez": "😶 Mudo Vázquez",
  "Julián Álvarez": "🕷️ La Araña",
  "Cole Palmer": "🧊 Cold Palmer",
  "Claude Beacons": "🔥 Torch",
  "Jordan Greenway": "🟩 Janus",
  "Ousmane Dembélé": "🦟 Mosquito",
};

export function computeLegacyTitle(player) {
  const name = String(player?.name || "").trim();

  if (SPECIAL_LEGACY_TITLES[name]) {
    return SPECIAL_LEGACY_TITLES[name];
  }

  const ca = Number(player?.ca);
  const cp = Number(player?.cp);
  const age = Number(player?.age);

  if (
    !Number.isFinite(ca) ||
    !Number.isFinite(cp) ||
    !Number.isFinite(age)
  ) {
    return "⚠️ Perfil indefinido";
  }

  if (cp >= 195) {
    if (age <= 21) {
      return "🪄 Heredero al trono";
    }

    if (cp >= 192) {
      if (ca <= 191) {
        return "🔱 Trono Dorado";
      }

      if (ca > 191) {
        return "👑 Rey absoluto";
      }
    }
  }

  if (cp > 180) {
    if (age <= 21) {
      if (ca >= 160) {
        return "🌠 Talento Generacional";
      }

      if (ca < 160) {
        return "⭐ Future Star";
      }
    }

    if (age <= 25) {
      if (ca >= 175) {
        return "🛰️ Élite Consolidada";
      }

      if (ca < 180) {
        return "🧬 Generación Alfa";
      }
    }

    if (age < 30) {
      if (ca > 188) {
        return "👑 Referente Mundial Absoluto";
      }

      if (ca >= 185) {
        return "📅 Marcador de Época";
      }

      if (ca > 180) {
        return "⚔️ Aspirante al Trono";
      }

      if (ca <= 175) {
        return "🕯️ Vestigio de grandeza";
      }

      if (ca < 185) {
        return "🏛️ Herencia de una generación";
      }

      if (ca <= 188) {
        return "🥋 Fenómeno Generacional";
      }
    }

    if (age >= 30) {
      return "🧠 Leyenda en Activo";
    }

    return "❌ Sin margen competitivo";
  }

  if (cp > 170) {
    if (age <= 21) {
      if (ca >= 150) {
        return "💫 Promesa Élite";
      }

      if (ca < 150) {
        return "🔮 Potencial Especial";
      }
    }

    if (age <= 25) {
      if (ca >= 165) {
        return "💥 Prodigio Generacional";
      }

      if (ca < 170) {
        return "🪙 Generación Beta";
      }
    }

    if (age < 30) {
      if (ca >= 180) {
        return "🎯 Titular de Élite";
      }

      if (ca > 175) {
        return "🗿 Estatura de élite";
      }

      if (ca >= 170) {
        return "🧿 Alta cuna futbolística";
      }

      if (ca < 170) {
        return "🦉 Maestro del Juego";
      }

      if (ca < 175) {
        return "⚙️ Pilar de Élite";
      }

      if (ca <= 180) {
        return "🧩 Elemento Crucial";
      }
    }

    if (age >= 30) {
      return "🧓 Estrella Veterana";
    }

    return "❌ Sin margen competitivo";
  }

  if (cp >= 165) {
    if (age <= 21) {
      if (ca >= 140) {
        return "🌟 Promesa Diferencial";
      }

      if (ca < 140) {
        return "⚡ Proyección de Estrella";
      }
    }

    if (age <= 25) {
      if (ca >= 160) {
        return "🦅 Referencia Generacional";
      }

      if (ca < 160) {
        return "🔥 Forjador del futuro";
      }
    }

    if (age < 30) {
      if (ca >= 160) {
        return "📏 Estándar de Élite";
      }

      if (ca < 160) {
        return "🥷 Élite Silenciosa";
      }
    }

    if (age >= 30) {
      return "🦅 Último emperador";
    }

    return "❌ Sin margen competitivo";
  }

  if (cp < 165) {
    if (age <= 21) {
      if (ca >= 130) {
        return "🌱 Promesa Proyectable";
      }

      if (ca < 130) {
        return "🎯 Jugador a Observar";
      }
    }

    if (age <= 25) {
      if (ca >= 150) {
        return "🧃 Talento a Seguir";
      }

      if (ca < 150) {
        return "🔬 Potencial Real";
      }
    }

    if (age < 30) {
      if (ca >= 150) {
        return "🧱 Perfil Competitivo";
      }

      if (ca < 150) {
        return "🧩 Jugador de Buen Nivel";
      }
    }

    if (age >= 30) {
      return "🧓 Veterano Competitivo";
    }

    return "❌ Sin margen competitivo";
  }

  return "⚠️ Perfil indefinido";
}

export default computeLegacyTitle;
