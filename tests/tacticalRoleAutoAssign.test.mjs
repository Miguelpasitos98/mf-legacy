import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTacticalRoles, hasTacticalRole, needsTacticalRoles, TACTICAL_ROLE_PROFILES, TACTICAL_ROLE_FAMILIES } from "../src/utils/tacticalRoleAutoAssign.mjs";

const groups = Object.entries(TACTICAL_ROLE_PROFILES).map(([group, profiles]) => ({
  group, options: profiles.map(([name]) => name)
}));
const player = {
  id: "player-1", name: "Jugador de prueba", position: "ED",
  stats: {
    mental: {movimiento:17, vision:12, talento:14, sacrificio:13, decisiones:14, consistencia:14, trabajo_de_equipo:13, serenidad:13, anticipacion:15, colocacion:7},
    physical: {aceleracion:19, velocidad:19, agilidad:17, balance:15, resistencia:15},
    technical: {regate:18, control:16, remate:12, pases:13, centros:13, tecnica:15, entradas:6}
  }, tactical_roles:[], description:""
};

test("dos roles diferentes del catálogo según los atributos, con pruebas trazables", () => {
  const result=evaluateTacticalRoles(player, [], groups);
  assert.equal(result.status,"ready");
  assert.equal(result.roles.length,2);
  assert.notEqual(result.roles[0].name,result.roles[1].name);
  assert.match(result.roles[0].description,/FM/);
  assert.equal(result.roles[0].name,"Line Breaker");
});

test("no infiere rol de portero sin atributos y protege fichas con edición manual", () => {
  assert.equal(evaluateTacticalRoles({...player,position:"GK",stats:{}},[],groups).status,"insufficient");
  assert.equal(needsTacticalRoles({...player,tactical_roles:[{name:"Rol manual"}]}),false);
  assert.equal(hasTacticalRole({...player,description:"Texto manual"}),true);
});

test("un rol contextual no se inventa solo por tener talento", () => {
  const result=evaluateTacticalRoles(player,[],groups);
  assert.ok(result.roles.every(r=>r.name!=="Chaotic Winger"));
  assert.equal(TACTICAL_ROLE_FAMILIES.DFC,"Centre-Backs");
});
