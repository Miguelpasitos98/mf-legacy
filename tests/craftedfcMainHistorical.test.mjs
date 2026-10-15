import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("La tabla principal CraftedFC usa comparador histórico y no percentiles FotMob", () => {
  const main = read("../src/components/stats/CraftedfcAnalysis.jsx");
  assert.match(main, /<HistoricalPeerPreview main /);
  assert.doesNotMatch(main, /calculateCompositeMF\(/);
  assert.doesNotMatch(main, /metricPercentiles\(/);
  assert.doesNotMatch(main, /fotmobRows/);
  assert.match(main, /snapshot global/);
});

test("El comparador principal se carga automáticamente y tiene barras y posición", () => {
  const preview = read("../src/components/stats/HistoricalPeerPreview.jsx");
  const loader = read("../src/hooks/useHistoricalPeerDataset.js");
  const stats = read("../src/pages/Stats.jsx");
  assert.match(preview, /useHistoricalPeerDataset\(main\)/);
  assert.match(loader, /enabled,staleTime/);
  assert.match(preview, /<PercentileBar item=\{item\}\/>/);
  assert.match(preview, /<PositionBar item=\{item\}\/>/);
  assert.match(stats, /<CraftedfcAnalysis/);
  assert.doesNotMatch(stats, /<HistoricalPeerPreview/);
});
