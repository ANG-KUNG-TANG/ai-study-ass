import { UserAIPolicyEntity } from "@/server/entities/user-ai-policy.entity";
import {
  UserAIPolicy,
  type UserAIPolicyPersistence,
} from "@/server/models/UserAIPolicy";

function toEntity(doc: UserAIPolicyPersistence): UserAIPolicyEntity {
  return UserAIPolicyEntity.fromPersistence({
    userId: String(doc._id),
    enabled: doc.enabled,
    dailyRequestLimit: doc.dailyRequestLimit ?? null,
    dailyTokenLimit: doc.dailyTokenLimit ?? null,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export async function findByUserId(
  userId: string,
): Promise<UserAIPolicyEntity | null> {
  const doc = await UserAIPolicy.findById(userId)
    .lean<UserAIPolicyPersistence>()
    .exec();

  return doc ? toEntity(doc) : null;
}

export async function save(
  entity: UserAIPolicyEntity,
): Promise<UserAIPolicyEntity> {
  const data = entity.toPublic();
  const doc = await UserAIPolicy.findOneAndUpdate(
    { _id: data.userId },
    {
      $set: {
        enabled: data.enabled,
        dailyRequestLimit: data.dailyRequestLimit,
        dailyTokenLimit: data.dailyTokenLimit,
        updatedBy: data.updatedBy,
      },
      $setOnInsert: { _id: data.userId },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .lean<UserAIPolicyPersistence>()
    .exec();

  if (!doc) {
    throw new Error("User AI policy could not be saved");
  }

  return toEntity(doc);
}

export async function deleteByUserId(userId: string): Promise<void> {
  await UserAIPolicy.deleteOne({ _id: userId }).exec();
}
