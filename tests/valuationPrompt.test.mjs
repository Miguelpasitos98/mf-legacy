import test from "node:test";
import assert from "node:assert/strict";
import { VALUATION_CSV_HEADER, buildValuationPrompt } from "../src/utils/valuationPrompt.js";
import { normalizeHistoricalPosition } from "../src/utils/historicalPositions.js";

test("el prompt pide Overall, posicion FIFA y Transfermarkt para cada temporada", () => {
  const text = buildValuationPrompt({
    playerName: "Havertz",
    seasons: ["2019/2020", "2020/2021"],
    fm26Uid: "62087624",
    fotmobPlayerId: "481454",
  });
  assert.match(text, /Posicion FIFA/);
  assert.match(text, /no la deduzcas ni la inventes/);
  assert.match(text, /Havertz;2019\/2020;;;;;;/);
  assert.match(text, /Havertz;2020\/2021;;;;;;/);
  assert.match(text, /62087624/);
  assert.equal(text.includes("Jugador;Temporada;FIFA/FC Overall;Posicion FIFA"), true);
});

test("la cabecera del prompt coincide con la que exporta el importador", () => {
  const text = buildValuationPrompt({ playerName: "X", seasons: ["2022/2023"] });
  assert.equal(text.includes(VALUATION_CSV_HEADER), true);
  assert.equal(VALUATION_CSV_HEADER.split(";").length, 8);
});

test("una posicion FIFA vacia no se convierte en un codigo inventado", () => {
  assert.equal(normalizeHistoricalPosition(""), "");
  assert.equal(normalizeHistoricalPosition(null), "");
  assert.equal(normalizeHistoricalPosition(" cam "), "CAM");
});