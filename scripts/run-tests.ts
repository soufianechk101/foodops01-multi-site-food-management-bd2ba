/* FoodOps — Point d'entrée CLI des tests du moteur (npm test) */
import { runEngineTests } from "../src/lib/tests";

const results = runEngineTests();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
if (failed > 0) process.exit(1);
