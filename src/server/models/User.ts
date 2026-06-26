import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/server/utils/constants";
import { USER_RULES, type UserRole } from "@/server/entities/user";


// ─── Types ────────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  // Stores the refresh token's jti (ID), not the full token string.
  // On refresh: compare incoming token's jti against this value.
  // Mismatch = reuse detected → revoke everything.
  role: UserRole;
  isActive: boolean;
  emailVerificationToken: string | null;
  emailVerifictionExpires:Date | null;
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
      minLength: [USER_RULES.name.minLenght, `Name must be at least ${USER_RULES.name.minLength} characters`],
      maxLength: [USER_RULES.name.maxLength, `Name cannot exceed ${USER_RULES.name.maxLength} characters`]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,        // duplicate → E11000 → ConflictError
      lowercase: true,     // normalise before save
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      select: false,       // never returned in queries by default
    },
    role: {
        type: String,
        enum: ["user", "admin"] satisfies UserRole[],
        default: "user"
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
    emailVerifictionExpires: {
        type: Date,
        default: null,
        selects: false,
    },
    refreshTokenId: {
      type: String,
      default: null,
      select: false,       // never returned in queries by default
    },
  },
  {
    timestamps: true,      // adds createdAt + updatedAt automatically
  }
);

// ─── Pre-save hook — hash password ────────────────────────────────────────────

userSchema.pre("save", async function (next) {
  // Only hash if password field was modified (not on email/name updates)
  if (!this.isModified("password")) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  next();
});

// ─── Instance method — compare password ───────────────────────────────────────

userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// ─── toJSON — strip sensitive fields from serialised output ───────────────────

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.emailVerificationToken;
    delete ret.emailVerifictionExpires
    delete ret.refreshTokenId;
    delete ret.__v;
    return ret;
  },
});

//indexes
/**
 * TTL index: auto-delete expired verificaion token after 24 h
 * this doesn't delete the user -just clears the token fields via a cleanup job
 * (mongodb ttl deletes whole docume)
 */

userSchema.index({ email: 1});
userSchema.index({emailVerificaionToken: 1}, {sparse: true});

// ─── Model ────────────────────────────────────────────────────────────────────
// Guard against Next.js hot-reload re-registering the model
export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);