import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/server/utils/constants";
import { USER_RULES, type UserRole } from "@/server/entities/user.entity"; // was "@/server/entities/user" — missing .entity

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
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

// ─── Pre-save hook — hash password ────────────────────────────────────────────

userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next(); // was "password" — field doesn't exist, hook never ran
  this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  next();
});

// ─── Instance method — compare password ───────────────────────────────────────

userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash); // was "this.password" — field doesn't exist, always false
};

// ─── toJSON — strip sensitive fields ──────────────────────────────────────────

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpires;  // was "emailVerifictionExpires" (typo) — nothing was deleted
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.refreshTokenId;
    delete ret.__v;
    return ret;
  },
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

userSchema.index({ email: 1 });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true }); // was "emailVerificaionToken" (typo) — index on wrong field
userSchema.index({ passwordResetToken: 1 }, { sparse: true });

// ─── Model ────────────────────────────────────────────────────────────────────

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);