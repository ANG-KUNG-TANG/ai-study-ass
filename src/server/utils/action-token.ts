import { createHash, randomBytes } from "node:crypto";

const ACTION_TOKEN_BYTES = 32;

export function generateActionToken(): string {
  return randomBytes(ACTION_TOKEN_BYTES).toString("hex");
}

export function hashActionToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}
