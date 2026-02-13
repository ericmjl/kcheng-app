/**
 * Build a JWKS data URI from public.pem for Convex Custom JWT (local dev).
 * Run from project root: node scripts/jwks-data-uri.cjs
 * Paste the output into Convex dashboard → Authentication → JWKS URL
 * and into convex/auth.config.ts jwks field.
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const pemPath = path.join(__dirname, "..", "public.pem");
if (!fs.existsSync(pemPath)) {
  console.error("Run from project root. public.pem not found at", pemPath);
  process.exit(1);
}

const pem = fs.readFileSync(pemPath, "utf8");
const key = crypto.createPublicKey(pem);
const jwk = key.export({ format: "jwk" });
const jwks = {
  keys: [{ ...jwk, use: "sig", alg: "RS256" }],
};
const dataUri =
  "data:application/json;base64," +
  Buffer.from(JSON.stringify(jwks)).toString("base64");

console.log("Paste this as the JWKS URL in Convex dashboard and in convex/auth.config.ts:\n");
console.log(dataUri);
