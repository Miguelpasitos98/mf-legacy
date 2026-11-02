import test from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";
import React from "react";
import { renderToString } from "react-dom/server";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

test("TacticalBuilder renders both empty and populated squads without crashing", async () => {
  const dir = mkdtempSync(path.join(process.cwd(), ".tactical-smoke-"));
  const output = path.join(dir, "module.cjs");
  try {
    await esbuild.build({
      entryPoints: ["src/components/teams/TacticalBuilder.jsx"],
      outfile: output,
      bundle: true,
      format: "cjs",
      platform: "node",
      packages: "external",
      alias: { "@": path.resolve("src") },
      plugins: [{
        name: "mock-browser-services",
        setup(build) {
          build.onResolve({ filter: /base44Client/ }, () => ({ path: "mock", namespace: "sdk-stub" }));
          build.onLoad({ filter: /.*/, namespace: "sdk-stub" }, () => ({
            contents: "export const base44={entities:{}};", loader: "js"
          }));
          build.onResolve({ filter: /^(lucide-react|html2canvas)$/ }, args => ({
            path: args.path, namespace: "ui-stub"
          }));
          build.onLoad({ filter: /.*/, namespace: "ui-stub" }, args => ({
            contents: args.path === "html2canvas"
              ? "export default async function(){return null;}"
              : "const Icon=()=>null;export {Icon as RotateCcw,Icon as Save,Icon as Trash2,Icon as Download,Icon as Palette,Icon as Search,Icon as X,Icon as ShieldCheck,Icon as AlertTriangle};",
            loader: "js"
          }));
        }
      }]
    });
    const TacticalBuilder = require(output).default;
    const team = { id: "example", name: "AFC Wimbledon", logo: "" };
    const baseProps = { team, season: "2026/2027", comparison: [], balanceComparison: [], onEnsurePlayer: async () => {} };
    const blank = renderToString(React.createElement(TacticalBuilder, { ...baseProps, roster: [], allPlayers: [] }));
    assert.match(blank, /Arma tu once/);
    assert.match(blank, /Equilibrio táctico/);
    const player = { id: "p1", name: "Test Player", position: "DC", ca: 145 };
    const populated = renderToString(React.createElement(TacticalBuilder, {
      ...baseProps,
      roster: [{ id: "m1", player_id: "p1", player, primary_position: "DC" }],
      allPlayers: [player]
    }));
    assert.match(populated, /Arma tu once/);
    assert.match(populated, /Equilibrio táctico/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
