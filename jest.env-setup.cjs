// Explicitly load .env.test before any test file (or its imports) runs.
// .cjs extension is required here: package.json has "type": "module", so a
// plain .js file would be parsed as ESM and `require` would not exist.
// next/jest's automatic loadEnvConfig should normally handle this, but it
// wasn't reliably firing in this project's setup, so we force it here.
const path = require("path");
const { config } = require("dotenv");

const result = config({
  path: path.resolve(__dirname, ".env.test"),
  // next/jest's own loadEnvConfig runs before setupFiles and may have
  // already populated process.env from the real .env (production values).
  // dotenv skips keys that already exist by default, so without this,
  // .env.test silently has no effect at all — override forces test values
  // to win regardless of what loaded first.
  override: true,
  debug: process.env.DEBUG === "true" || process.env.DEBUG === "1",
});

if (result.error) {
  console.error(
    "[jest.env-setup] Failed to load .env.test:",
    result.error.message,
  );
  throw result.error;
}

// Uncomment temporarily if you need to confirm vars are actually loaded:
// console.log("[jest.env-setup] Loaded env keys:", Object.keys(result.parsed || {}));