import { ValidationError } from "@/server/utils/errors";

// ─── Rules — single source of truth ──────────────────────────────────────────

export const USER_RULES = {
  name: {
    minLength: 2,
    maxLength: 100,
  },
  email: {
    minLength: 5,
    maxLength: 254,
    allowedDomains: ["gmail.com", "company.com"],
    allowDisposable: false,
  },
  password: {
    minLength: 8,
    maxLength: 72,          // bcrypt hard limit — was 78 in your version, must be 72
    requireLowercase: true,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,    // was "requiredNumber" (typo) in your version
  },
  emailVerification: {      // was "emailVerificaition" (typo) in your version
    expiresInMs: 24 * 60 * 60 * 1000,
  },
  passwordReset: {
    expiresInMs: 60 * 60 * 1000,  // 1 hour
  },
} as const;

// ─── Domain types ─────────────────────────────────────────────────────────────

export type UserId = string;
export type UserRole = "user" | "admin";

export interface UserProps {
  id: UserId;
  name: string;
  email: string;
  passwordHash: string;
  googleSubject?: string | null;
  /**
   * Optional for backward compatibility with accounts created before this
   * field existed. The entity derives a safe value from googleSubject when it
   * is absent.
   */
  passwordConfigured?: boolean;
  role: UserRole;
  /** Administrative account state (for example, banned/unbanned). */
  isActive: boolean;              // was Boolean (capital B) — use primitive boolean
  /** Separate from isActive so email verification cannot undo an admin ban. */
  emailVerified?: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  refreshTokenId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublicProfile {
  id: UserId;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  passwordConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;              // was "updateAt" (typo) in your version
}

// ─── Domain validation ────────────────────────────────────────────────────────

function validateName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length < USER_RULES.name.minLength) {
    throw new ValidationError("Validation failed", {
      name: `Name must be at least ${USER_RULES.name.minLength} characters`, // was "cannot exceed" for minLength — wrong message
    });
  }
  if (trimmed.length > USER_RULES.name.maxLength) {
    throw new ValidationError("Validation failed", {
      name: `Name cannot exceed ${USER_RULES.name.maxLength} characters`,
    });
  }
}

function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // was [^/s@] (/ instead of \) — regex broken
  if (!emailRegex.test(email.trim())) {
    throw new ValidationError("Validation failed", {
      email: "Invalid email format",
    });
  }
}

export function validatePasswordStrength(password: string): void {
  if (password.length < USER_RULES.password.minLength) {
    throw new ValidationError("Validation failed", {
      password: `Password must be at least ${USER_RULES.password.minLength} characters`,
    });
  }
  if (password.length > USER_RULES.password.maxLength) {
    throw new ValidationError("Validation failed", {
      password: `Password cannot exceed ${USER_RULES.password.maxLength} characters`, // was "must be at least" for maxLength — wrong message
    });
  }
  if (USER_RULES.password.requireLowercase && !/[a-z]/.test(password)) {
    throw new ValidationError("Validation failed", {
      password: "Password must contain at least one lowercase letter",
    });
  }
  if (USER_RULES.password.requireUppercase && !/[A-Z]/.test(password)) {
    throw new ValidationError("Validation failed", {
      password: "Password must contain at least one uppercase letter",
    });
  }
  if (USER_RULES.password.requireNumber && !/[0-9]/.test(password)) {  // was "requiredNumber"
    throw new ValidationError("Validation failed", {
      password: "Password must contain at least one number",
    });
  }
  if (USER_RULES.password.requireSpecial && !/[!@#$%^&*(){}~]/.test(password)) {
    throw new ValidationError("Validation failed", {
      password: "Password must contain at least one special character",
    });
  }
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class UserEntity {
  readonly #id: UserId;
  readonly #name: string;
  readonly #email: string;
  readonly #passwordHash: string;
  readonly #googleSubject: string | null;
  readonly #passwordConfigured: boolean;
  readonly #role: UserRole;
  readonly #isActive: boolean;
  readonly #emailVerified: boolean;
  readonly #emailVerificationToken: string | null;
  readonly #emailVerificationExpires: Date | null;
  readonly #passwordResetToken: string | null;    // was Date | null — wrong type
  readonly #passwordResetExpires: Date | null;
  readonly #refreshTokenId: string | null;
  readonly #createdAt: Date;
  readonly #updatedAt: Date;

  private constructor(props: UserProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#email = props.email;
    this.#passwordHash = props.passwordHash;
    this.#googleSubject = props.googleSubject ?? null;
    this.#passwordConfigured =
      props.passwordConfigured ?? !props.googleSubject;
    this.#role = props.role;
    this.#isActive = props.isActive;
    // Existing records used isActive as the verification flag. Active legacy
    // accounts are therefore treated as verified until they are persisted in
    // the new shape.
    this.#emailVerified = props.emailVerified ?? props.isActive;
    this.#emailVerificationToken = props.emailVerificationToken;
    this.#emailVerificationExpires = props.emailVerificationExpires;
    this.#passwordResetToken = props.passwordResetToken;
    this.#passwordResetExpires = props.passwordResetExpires;
    this.#refreshTokenId = props.refreshTokenId;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
  }

  // ─── Getters ──────────────────────────────────────────────────────────────────

  get id(): UserId { return this.#id; }               // was "if" (typo) — would never work
  get name(): string { return this.#name; }
  get email(): string { return this.#email; }          // was "return this.email" — infinite loop
  get passwordHash(): string { return this.#passwordHash; }
  get googleSubject(): string | null { return this.#googleSubject; }
  get passwordConfigured(): boolean { return this.#passwordConfigured; }
  get role(): UserRole { return this.#role; }
  get isActive(): boolean { return this.#isActive; }
  get emailVerified(): boolean { return this.#emailVerified; }
  get emailVerificationToken(): string | null { return this.#emailVerificationToken; }
  get emailVerificationExpires(): Date | null { return this.#emailVerificationExpires; } // was string | null — wrong type
  get passwordResetToken(): string | null { return this.#passwordResetToken; }
  get passwordResetExpires(): Date | null { return this.#passwordResetExpires; }
  get refreshTokenId(): string | null { return this.#refreshTokenId; }
  get createdAt(): Date { return this.#createdAt; }
  get updatedAt(): Date { return this.#updatedAt; }

  // ─── Factory: new registration ────────────────────────────────────────────────

  static create(input: {
    id: UserId;
    name: string;
    email: string;
    passwordHash: string;
    emailVerificationToken: string;   // was "emailVerificaitonToken" (typo)
  }): UserEntity {
    validateName(input.name);
    validateEmail(input.email);

    const expiresAt = new Date(
      Date.now() + USER_RULES.emailVerification.expiresInMs  // was "emailVerificaition"
    );

    return new UserEntity({
      id: input.id,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      googleSubject: null,
      passwordConfigured: true,
      role: "user",
      // A newly registered account is enabled but cannot log in until its
      // email is verified. Administrative activation is a separate concern.
      isActive: true,
      emailVerified: false,
      emailVerificationToken: input.emailVerificationToken,
      emailVerificationExpires: expiresAt,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ─── Factory: Google registration ───────────────────────────────────────────

  static createGoogle(input: {
    id: UserId;
    name: string;
    email: string;
    passwordHash: string;
    googleSubject: string;
  }): UserEntity {
    validateName(input.name);
    validateEmail(input.email);

    if (!input.googleSubject.trim()) {
      throw new ValidationError("Validation failed", {
        google: "Google account identifier is required",
      });
    }

    return new UserEntity({
      id: input.id,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      googleSubject: input.googleSubject,
      passwordConfigured: false,
      role: "user",
      isActive: true,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshTokenId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ─── Factory: reconstitute from DB ───────────────────────────────────────────

  static fromPersistence(props: UserProps): UserEntity {
    return new UserEntity(props);
  }

  // ─── Domain behaviour ─────────────────────────────────────────────────────────

  isAdmin(): boolean {
    return this.#role === "admin";
  }

  hasActiveSession(): boolean {
    return this.#refreshTokenId !== null;
  }

  canLogin(): { allowed: boolean; reason?: string } {
    if (!this.#isActive) {
      return {
        allowed: false,
        reason: "Account disabled",
      };
    }
    if (!this.#emailVerified) {
      return {
        allowed: false,
        reason: "Account not verified — please check your email",
      };
    }
    return { allowed: true };
  }

  isVerificationTokenValid(tokenHash: string): boolean {
    if (!this.#emailVerificationToken || !this.#emailVerificationExpires) return false;
    if (this.#emailVerificationToken !== tokenHash) return false;
    if (new Date() > this.#emailVerificationExpires) return false;
    return true;
  }

  isPasswordResetTokenValid(tokenHash: string): boolean {
    if (!this.#passwordResetToken || !this.#passwordResetExpires) return false;
    if (this.#passwordResetToken !== tokenHash) return false;
    if (new Date() > this.#passwordResetExpires) return false;
    return true;
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  toPublic(): UserPublicProfile {
    return {
      id: this.#id,
      name: this.#name,
      email: this.#email,
      role: this.#role,
      isActive: this.#isActive,
      emailVerified: this.#emailVerified,
      passwordConfigured: this.#passwordConfigured,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,   // was "updateAt" (typo) + was this.createdAt (wrong field)
    };
  }

  toPersistence(): UserProps {
    return {
      id: this.#id,
      name: this.#name,
      email: this.#email,
      passwordHash: this.#passwordHash,
      googleSubject: this.#googleSubject,
      passwordConfigured: this.#passwordConfigured,
      role: this.#role,
      isActive: this.#isActive,           // was this.isActive (getter) instead of #isActive
      emailVerified: this.#emailVerified,
      emailVerificationToken: this.#emailVerificationToken,
      emailVerificationExpires: this.#emailVerificationExpires,
      passwordResetToken: this.#passwordResetToken,   // was this.passwordResetToken (getter)
      passwordResetExpires: this.#passwordResetExpires, // was this.passwordHash — completely wrong
      refreshTokenId: this.#refreshTokenId,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }
}
