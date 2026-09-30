import { PLAYER_DESCRIPTIONS } from "@/lib/playerDescriptions";

export const POSITION_GROUPS = {
  goalkeepers: {
    title: "Goalkeepers",
    positions: ["GK"],
  },

  centreBacks: {
    title: "Centre-Backs",
    positions: ["DFC"],
  },

  fullBacks: {
    title: "Full-Backs / Wing-Backs",
    positions: ["LD", "LI", "CRD", "CRI"],
  },

  centralMidfielders: {
    title: "Central Midfielders",
    positions: ["CDM", "CM"],
  },

  attackingMidfielders: {
    title: "Attacking Midfielders",
    positions: ["CAM"],
  },

  wingers: {
    title: "Wingers",
    positions: ["EI", "ED"],
  },

  strikers: {
    title: "Strikers",
    positions: ["DC"],
  },
};

const POSITION_GROUP_ORDER = [
  "goalkeepers",
  "centreBacks",
  "fullBacks",
  "centralMidfielders",
  "attackingMidfielders",
  "wingers",
  "strikers",
];

export const getRatedPositions = (player) => {
  const ratings = player?.position_ratings || {};

  return Object.entries(ratings)
    .map(([code, value]) => ({
      code,
      rating: Number(value),
    }))
    .filter(
      ({ rating }) =>
        Number.isFinite(rating) &&
        rating > 0
    )
    .sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }

      return a.code.localeCompare(b.code);
    });
};

export const getPrimaryPosition = (player) => {
  const ratedPositions = getRatedPositions(player);

  return ratedPositions[0]?.code || "";
};

export const getPositionGroupKey = (positionCode) => {
  for (const groupKey of POSITION_GROUP_ORDER) {
    const group = POSITION_GROUPS[groupKey];

    if (group.positions.includes(positionCode)) {
      return groupKey;
    }
  }

  return null;
};

export const getPositionGroup = (player) => {
  const primaryPosition = getPrimaryPosition(player);

  if (!primaryPosition) {
    return "Special Roles";
  }

  const groupKey = getPositionGroupKey(primaryPosition);

  if (!groupKey) {
    return "Special Roles";
  }

  return POSITION_GROUPS[groupKey].title;
};

export const getAvailablePlayerDescriptions = (player) => {
  const groupTitle = getPositionGroup(player);

  const group = PLAYER_DESCRIPTIONS.find(
    (item) => item.group === groupTitle
  );

  return group?.options || [];
};

export const computePlayerDescription = (player) => {
  /*
   * Todavía no hacemos aquí la asignación automática
   * mediante CA + CP + edad.
   *
   * Primero dejamos preparada la relación:
   *
   * position_ratings
   *        ↓
   * posición principal
   *        ↓
   * grupo de posición
   *        ↓
   * descripciones disponibles
   */

  if (player?.description) {
    return player.description;
  }

  return "";
};

export default computePlayerDescription;
