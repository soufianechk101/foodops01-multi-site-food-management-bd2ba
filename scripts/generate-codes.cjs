#!/usr/bin/env node
// Génère des codes d'activation FoodOps (offline)
// usage: node scripts/generate-codes.cjs --demo 10 --life 5
const { generateCode } = require("../electron/activation.cjs");

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(name);
  if (i !== -1 && args[i+1]) return parseInt(args[i+1], 10);
  return def;
}
const demoN = getArg("--demo", 3);
const lifeN = getArg("--life", 2);

console.log("=== FoodOps Codes d'activation ===\n");
console.log(`DEMO (5 jours) — ${demoN} codes:`);
for (let i=0;i<demoN;i++) console.log("  " + generateCode("DEMO"));
console.log(`\nLIFE (à vie) — ${lifeN} codes:`);
for (let i=0;i<lifeN;i++) console.log("  " + generateCode("LIFE"));
console.log("\nConservez-les. Validation offline via electron/activation.cjs");
