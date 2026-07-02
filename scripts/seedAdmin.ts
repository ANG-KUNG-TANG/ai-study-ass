/**
 * scripts/seed-admin.ts
 *
 * One-time / repeatable admin bootstrap script — NOT an API route.
 * Run manually, locally, with your own DB credentials. Solves the
 * chicken-and-egg problem: register() always sets role="user", and
 * updateUserRole() requires you to already be an admin to call it.
 *
 * Behavior:
 *   - If a user with this email already exists → promote to admin,
 *     force isActive=true (skips email verification).
 *   - If no user exists → create a brand-new admin account directly,
 *     bypassing the normal register() flow (no verification email sent).
 *
 * Usage:
 *   1. Install a TS runner if you don't have one:  npm install -D tsx
 *   2. Set the constants below (or read from env — see note at bottom).
 *   3. Run:  npx tsx scripts/seed-admin.ts
 *
 * Safe to re-run — it's idempotent (upsert-style), so running it twice
 * just confirms the account is already an admin.
 */

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { connectDb, disxonnectDB } from "@/server/config/database"; // adjust path to match your actual location
import { User } from "@/server/models/User";
import { UserEntity } from "@/server/entities/user.entity";
import { BCRYPT_ROUNDS } from "@/server/utils/constants";

// ─── Configure your admin account here ─────────────────────────────────────
// Change these before running, or wire them up to process.env if you prefer
// (e.g. ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD read via process.env.X).

const ADMIN_EMAIL = "ai-admin@system.io.com";
const ADMIN_NAME = "ai-study-assistant";
const ADMIN_PASSWORD = "StrongPassword123!"; // only used if creating a NEW user — meets USER_RULES password strength requirements

// ─────────────────────────────────────────────────────────────────────────

async function seedAdmin() {
  await connectDb();

  const email = ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email }).exec();

  if (existing) {
    if (existing.role === "admin" && existing.isActive) {
      console.log(`✅ ${email} is already an active admin — nothing to do.`);
      return;
    }

    existing.role = "admin";
    existing.isActive = true;
    await existing.save();

    console.log(`✅ Promoted existing user to admin: ${email} (id: ${existing._id})`);
    return;
  }

  // No existing user — create a fresh admin account directly.
  // We reuse UserEntity.create() for validation/consistency, then
  // override role/isActive since this bypasses normal registration.
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const entity = UserEntity.create({
    id: randomUUID(),
    name: ADMIN_NAME,
    email,
    passwordHash,
    emailVerificationToken: randomUUID(), // required by create(), unused — we activate immediately below
  });

  const data = entity.toPersistence();

  const doc = await User.create({
    _id: data.id,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    role: "admin",          // override — entity.create() always sets "user"
    isActive: true,         // override — skip email verification entirely
    emailVerificationToken: null,
    emailVerificationExpires: null,
    refreshTokenId: null,
  });

  console.log(`✅ Created new admin account: ${email} (id: ${doc._id})`);
  console.log(`   Password: ${ADMIN_PASSWORD}  (change this after first login)`);
}

seedAdmin()
  .catch((err) => {
    console.error("❌ Seed script failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disxonnectDB(); // note: matches the existing (typo'd) export name in database.ts
    process.exit();
  });