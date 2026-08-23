import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";
import { USER_RULES, type UserRole } from "@/server/entities/user.entity"; // was "@/server/entities/user" — missing .entity
// BCRYPT_ROUNDS no longer imported here — hashing lives upstream (service layer), not in the model.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  googleSubject: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;  // was "emailVerifictionExpires" (typo)
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  refreshTokenId: string | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUser>(
  {
    // Explicit String _id — UserEntity.create() generates UUIDs via
    // randomUUID(), not Mongo ObjectIds. Without this, Mongoose defaults
    // _id to ObjectId and rejects every insert with a cast error.
    _id: String,
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [USER_RULES.name.minLength, `Name must be at least ${USER_RULES.name.minLength} characters`], // was "minLenght" + "minLenght" in value
      maxlength: [USER_RULES.name.maxLength, `Name cannot exceed ${USER_RULES.name.maxLength} characters`],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    googleSubject: {
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"] satisfies UserRole[],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },
    emailVerificationExpires: {   // was "emailVerifictionExpires" (typo) — field name must match IUser
      type: Date,
      default: null,
      select: false,              // was "selects: false" (typo) — not a valid Mongoose option
    },
    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },
    refreshTokenId: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Password hashing ──────────────────────────────────────────────────────────
// Deliberately NOT hashed here. UserEntity.create()/your auth service already
// produce a bcrypt hash before the entity is built (that's why the field is
// typed and named `passwordHash`, not `password`). Hashing again on `pre("save")`
// would double-hash the value and silently break every login. If you'd rather
// have the model own hashing instead, do it here AND stop hashing upstream —
// pick exactly one layer, never both.

// ─── Instance method — compare password ───────────────────────────────────────

userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash); // was "this.password" — field doesn't exist, always false
};

// ─── toJSON — strip sensitive fields ──────────────────────────────────────────

const toPublicJSON = (_doc: unknown, ret: any) => {
  // Destructure-omit instead of `delete ret.field` — under strict TS, `delete`
  // requires the property to be optional on the target type, which IUser's
  // fields are not. Destructuring avoids that restriction entirely.
  const {
    passwordHash,
    googleSubject,
    emailVerificationToken,
    emailVerificationExpires,
    passwordResetToken,
    passwordResetExpires,
    refreshTokenId,
    __v,
    ...publicRet
  } = ret;
  return publicRet;
};

userSchema.set("toJSON", { transform: toPublicJSON });
userSchema.set("toObject", { transform: toPublicJSON }); // covers .toObject()/lean() call sites too

// ─── Indexes ──────────────────────────────────────────────────────────────────

// email index is already created by `unique: true` on the field above —
// declaring it again here caused the duplicate schema index warning.
userSchema.index({ emailVerificationToken: 1 }, { sparse: true }); // was "emailVerificaionToken" (typo) — index on wrong field
userSchema.index({ passwordResetToken: 1 }, { sparse: true });
userSchema.index(
  { googleSubject: 1 },
  {
    unique: true,
    partialFilterExpression: { googleSubject: { $type: "string" } },
  },
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
