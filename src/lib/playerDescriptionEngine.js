import { PLAYER_DESCRIPTIONS } from "@/lib/playerDescriptions";

const POSITION_GROUPS = {
  goalkeepers: ["GK"],

  centreBacks: ["DFC"],

  fullBacks: ["LD", "LI", "CRD", "CRI"],

  centralMidfielders: ["CDM", "CM"],

  attackingMidfielders: ["CAM"],

  wingers: ["EI", "ED"],

  strikers: ["DC"],
};

const getPositionGroup = (positions = []) => {
  const normalizedPositions = Array.isArray(positions)
    ? positions.map((position) =>
        String(position || "").trim().toUpperCase()
      )
    : [];

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.goalkeepers.includes(position)
  )) {
    return "Goalkeepers";
  }

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.centreBacks.includes(position)
  )) {
    return "Centre-Backs";
  }

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.fullBacks.includes(position)
  )) {
    return "Full-Backs / Wing-Backs";
  }

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.centralMidfielders.includes(position)
  )) {
    return "Central Midfielders";
  }

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.attackingMidfielders.includes(position)
  )) {
    return "Attacking Midfielders";
  }

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.wingers.includes(position)
  )) {
    return "Wingers";
  }

  if (normalizedPositions.some((position) =>
    POSITION_GROUPS.strikers.includes(position)
  )) {
    return "Strikers";
  }

  return "Special Roles";
};

const getDescriptionsForGroup = (group) => {
  const foundGroup = PLAYER_DESCRIPTIONS.find(
    (item) => item.group === group
  );

  return foundGroup?.options || [];
};

export const getPlayerDescriptionGroup = (player) => {
  return getPositionGroup(player?.positions);
};

export const getAvailablePlayerDescriptions = (player) => {
  const group = getPositionGroup(player?.positions);

  return getDescriptionsForGroup(group);
};

export const computePlayerDescription = (player) => {
  // Si el jugador ya tiene una descripción guardada,
  // respetamos ese valor.
  if (player?.description) {
    return player.description;
  }

  // Determinamos el grupo de descripción según sus posiciones.
  const group = getPositionGroup(player?.positions);

  // Obtenemos las descripciones válidas para ese grupo.
  const availableDescriptions = getDescriptionsForGroup(group);

  // Todavía no elegimos automáticamente una descripción
  // porque las reglas CA + CP + edad aún no están definidas.
  if (availableDescriptions.length === 0) {
    return "";
  }

  return "";
};

export default computePlayerDescription;
