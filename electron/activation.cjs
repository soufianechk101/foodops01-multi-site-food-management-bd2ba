/* ============================================================
   FoodOps — Activation (offline HMAC, sans serveur)
   2 types de codes:
     FOODOPS-DEMO-XXXX-XXXX  →  5 jours depuis activation
     FOODOPS-LIFE-XXXX-XXXX  →  à vie
   Validation: HMAC-SHA256(secret, payload) tronqué 8 chars
   Génération côté dev uniquement (script).
   ============================================================ */
const crypto = require("crypto");

const SECRET = "FOODOPS-2026-ACTIVATION-v1-c2f9e8a1"; // gardé côté main uniquement
const PREFIX = "FOODOPS";

function hmacPayload(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex").toUpperCase().slice(0, 8);
}

function makeSegment(type) {
  // 4 chars aléatoires base36 + 4 chars hmac
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  const sig = hmacPayload(`${type}-${rand}`);
  return `${rand}${sig.slice(0, 4)}`;
}

function generateCode(type) {
  // type: 'DEMO' | 'LIFE'
  if (!["DEMO", "LIFE"].includes(type)) throw new Error("type DEMO|LIFE");
  const seg1 = makeSegment(type);
  const seg2 = makeSegment(type + seg1);
  return `${PREFIX}-${type}-${seg1}-${seg2}`;
}

function validateCode(code) {
  if (!code || typeof code !== "string") return { valid: false, type: null, reason: "Code vide" };
  const norm = code.trim().toUpperCase();

  // Codes spéciaux prédéfinis (compatibilité)
  const SPECIAL_CODES = {
    "FOODOPS-DEMO-1149-4512-6561-4938": "demo",
    "FOODOPS-LIFE-9149-4982-4445-6506": "life"
  };
  if (SPECIAL_CODES[norm]) {
    return { valid: true, type: SPECIAL_CODES[norm], reason: null };
  }

  const parts = norm.split("-");
  // FOODOPS-DEMO-XXXXXXXX-XXXXXXXX ou FOODOPS-LIFE-XXXXXXXX-XXXXXXXX
  if (parts.length !== 4 || parts[0] !== PREFIX || !["DEMO", "LIFE"].includes(parts[1])) {
    return { valid: false, type: null, reason: "Format invalide. Ex: FOODOPS-DEMO-XXXXXXXX-XXXXXXXX" };
  }
  const type = parts[1];
  const seg1 = parts[2];
  const seg2 = parts[3];
  if (seg1.length !== 8 || seg2.length !== 8) return { valid: false, type: null, reason: "Code incomplet (8 chars par segment)" };

  // re-calcule signature seg1
  const rand1 = seg1.slice(0, 4);
  const expectedSig1 = hmacPayload(`${type}-${rand1}`).slice(0, 4);
  if (seg1.slice(4, 8) !== expectedSig1) return { valid: false, type: null, reason: "Code invalide (sig1)" };

  // re-calcule seg2
  const rand2 = seg2.slice(0, 4);
  const check2 = hmacPayload(`${type + seg1}-${rand2}`).slice(0, 4);
  if (seg2.slice(4, 8) !== check2) return { valid: false, type: null, reason: "Code invalide (sig2)" };

  return { valid: true, type: type === "DEMO" ? "demo" : "life", reason: null };
}

module.exports = { generateCode, validateCode, SECRET };
