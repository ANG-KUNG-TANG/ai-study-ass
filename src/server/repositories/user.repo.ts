import { User } from "@/server/models/User";
import { UserEntity, type UserProps, type UserId, type UserRole } from "@/server/entities/user.entity";
import { logger } from "@/server/utils/logger";
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "@/server/utils/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserQueryOptions {
  page?: number;
  limit?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;          // matches name or email substring
  sortBy?: "createdAt" | "name" | "email";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedUsers {
  data: UserEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface SensitiveFieldOptions {
  withPassword?: boolean;
  withRefreshTokenId?: boolean;
  withVerificationToken?: boolean;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────
// Converts a raw Mongoose document → UserEntity.
// Handles select:false fields that may or may not be present.

function toEntity(doc: any): UserEntity {
  const props: UserProps = {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    passwordHash: doc.passwordHash ?? "",
    role: doc.role,
    isActive: doc.isActive,
    emailVerificationToken: doc.emailVerificationToken ?? null,
    emailVerificationExpires: doc.emailVerificationExpires ?? null,
    refreshTokenId: doc.refreshTokenId ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  return UserEntity.fromPersistence(props);
}

// Builds the select string based on which sensitive fields are needed
function buildSelect(options: SensitiveFieldOptions = {}): string {
  const extras: string[] = [];
  if (options.withPassword) extras.push("+passwordHash");
  if (options.withRefreshTokenId) extras.push("+refreshTokenId");
  if (options.withVerificationToken) extras.push("+emailVerificationToken +emailVerificationExpires");
  return extras.join(" ");
}

// ─── READ — single record ─────────────────────────────────────────────────────

export async function findById(
  id: UserId,
  sensitive: SensitiveFieldOptions = {}
): Promise<UserEntity | null> {
  const select = buildSelect(sensitive);
  const doc = await User.findById(id)
    .select(select || undefined)
    .lean()
    .exec();

  if (!doc) return null;
  return toEntity(doc);
}

export async function findByEmail(
  email: string,
  sensitive: SensitiveFieldOptions = {}
): Promise<UserEntity | null> {
  const select = buildSelect(sensitive);
  const doc = await User.findOne({ email: email.toLowerCase().trim() })
    .select(select || undefined)
    .lean()
    .exec();

  if (!doc) return null;
  return toEntity(doc);
}

export async function findByVerificationToken(
  token: string
): Promise<UserEntity | null> {
  const doc = await User.findOne({ emailVerificationToken: token })
    .select("+emailVerificationToken +emailVerificationExpires")
    .lean()
    .exec();

  if (!doc) return null;
  return toEntity(doc);
}

export async function existsByEmail(email: string): Promise<boolean> {
  return Boolean(
    await User.exists({ email: email.toLowerCase().trim() })
  );
}

// ─── READ — list ──────────────────────────────────────────────────────────────
// Single function for all list queries. Service layer applies its own
// access rules before calling — repo just executes what it's told.

export async function findMany(
  options: UserQueryOptions = {}
): Promise<PaginatedUsers> {
  const page = Math.max(1, options.page ?? DEFAULT_PAGE);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  const sortBy = options.sortBy ?? "createdAt";

  // Build filter
  const filter: Record<string, unknown> = {};
  if (options.role !== undefined) filter.role = options.role;
  if (options.isActive !== undefined) filter.isActive = options.isActive;
  if (options.search) {
    const regex = new RegExp(options.search.trim(), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    User.countDocuments(filter),
  ]);

  return {
    data: docs.map(toEntity),
    total,
    page,
    limit,
  };
}

// ─── AGGREGATE ────────────────────────────────────────────────────────────────

export async function count(
  filter: { role?: UserRole; isActive?: boolean } = {}
): Promise<number> {
  return User.countDocuments(filter);
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function create(entity: UserEntity): Promise<UserEntity> {
  const data = entity.toPersistence();

  const doc = await User.create({
    _id: data.id,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,   // pre-save hook hashes this
    role: data.role,
    isActive: data.isActive,
    emailVerificationToken: data.emailVerificationToken,
    emailVerificationExpires: data.emailVerificationExpires,
    refreshTokenId: data.refreshTokenId,
  });

  logger.info("User created", { userId: String(doc._id) });
  return toEntity(doc.toObject());
}

// ─── UPDATE — auth flows ──────────────────────────────────────────────────────

export async function activate(id: UserId): Promise<void> {
  await User.findByIdAndUpdate(id, {
    isActive: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    updatedAt: new Date(),
  });
  logger.info("User activated", { userId: id });
}

export async function updateRefreshTokenId(
  id: UserId,
  refreshTokenId: string | null
): Promise<void> {
  await User.findByIdAndUpdate(id, {
    refreshTokenId,
    updatedAt: new Date(),
  });
}

// Pre-save hook does NOT run on findByIdAndUpdate —
// caller must pass an already-hashed value.
export async function updatePassword(
  id: UserId,
  passwordHash: string
): Promise<void> {
  await User.findByIdAndUpdate(id, {
    passwordHash,
    refreshTokenId: null,   // invalidate all sessions
    updatedAt: new Date(),
  });
  logger.info("Password updated", { userId: id });
}

export async function updateVerificationToken(
  id: UserId,
  token: string,
  expires: Date
): Promise<void> {
  await User.findByIdAndUpdate(id, {
    emailVerificationToken: token,
    emailVerificationExpires: expires,
    updatedAt: new Date(),
  });
}

export async function clearVerificationToken(id: UserId): Promise<void> {
  await User.findByIdAndUpdate(id, {
    emailVerificationToken: null,
    emailVerificationExpires: null,
    updatedAt: new Date(),
  });
}

// ─── UPDATE — general ─────────────────────────────────────────────────────────

export async function updateProfile(
  id: UserId,
  data: { name?: string }
): Promise<UserEntity | null> {
  const doc = await User.findByIdAndUpdate(
    id,
    { ...data, updatedAt: new Date() },
    { new: true }             // return updated doc
  )
    .lean()
    .exec();

  if (!doc) return null;
  return toEntity(doc);
}

export async function updateRole(
  id: UserId,
  role: UserRole
): Promise<void> {
  await User.findByIdAndUpdate(id, {
    role,
    updatedAt: new Date(),
  });
  logger.info("User role updated", { userId: id, role });
}

export async function setActive(
  id: UserId,
  isActive: boolean
): Promise<void> {
  await User.findByIdAndUpdate(id, {
    isActive,
    updatedAt: new Date(),
  });
  logger.info(`User ${isActive ? "unbanned" : "banned"}`, { userId: id });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteById(id: UserId): Promise<void> {
  await User.findByIdAndDelete(id);
  logger.info("User deleted", { userId: id });
}

//upadte password reset flow
export async function updatePasswordReset(
  id:UserId,
  token: string,
  expires: Date
): Promise<void>{
  await User.findByIdAndUpadate(id, {
    passwordResetToken: token,
    passwordResetExpires: expires,
    updatedAt: new Date(),
  });
  
}

export async function clearPasswordResetToken(
  id:UserId): Promise<void> {
    await User.findByIdAndUpadte(id, {
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    }); 
}

export async function findByPasswordResetToken(
  token:string): Promise<UserEntity | null> {
    const doc = await User.findOne({ passwordResetToken: token})
      .selet("+passwordResettoken +passwordResetExpires")
      .lean()
      .exec();
    
    if (!doc) return null;
    return toEntity(doc);
  
}