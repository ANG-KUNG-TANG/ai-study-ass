import {
  FeedbackEntity,
  type FeedbackAdminView,
  type FeedbackStatus,
  type FeedbackType,
} from "@/server/entities/feedback.entity";
import { Feedback } from "@/server/models/Feedback";

export interface FeedbackQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: FeedbackType;
  status?: FeedbackStatus;
}

function toEntity(doc: {
  _id: unknown;
  userId: string;
  userEmail: string;
  type: FeedbackType;
  title: string;
  message: string;
  rating?: number | null;
  sourcePath?: string;
  status: FeedbackStatus;
  adminNote?: string;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): FeedbackEntity {
  return FeedbackEntity.fromPersistence({
    id: String(doc._id),
    userId: doc.userId,
    userEmail: doc.userEmail,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    rating: doc.rating ?? null,
    sourcePath: doc.sourcePath ?? "",
    status: doc.status,
    adminNote: doc.adminNote ?? "",
    reviewedBy: doc.reviewedBy ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(query: FeedbackQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { title: pattern },
      { message: pattern },
      { userEmail: pattern },
      { sourcePath: pattern },
    ];
  }

  return filter;
}

export async function create(entity: FeedbackEntity): Promise<FeedbackEntity> {
  const data = entity.toAdminView();
  const doc = await Feedback.create({
    _id: data.id,
    userId: data.userId,
    userEmail: data.userEmail,
    type: data.type,
    title: data.title,
    message: data.message,
    rating: data.rating,
    sourcePath: data.sourcePath,
    status: data.status,
    adminNote: data.adminNote,
    reviewedBy: data.reviewedBy,
    reviewedAt: data.reviewedAt,
  });

  return toEntity(doc.toObject());
}

export async function findRecentByUser(
  userId: string,
  limit: number,
): Promise<FeedbackEntity[]> {
  const docs = await Feedback.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map(toEntity);
}

export async function findPage(query: FeedbackQuery): Promise<{
  data: FeedbackEntity[];
  total: number;
}> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(query.limit ?? 20)));
  const filter = buildFilter(query);

  const [docs, total] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    Feedback.countDocuments(filter).exec(),
  ]);

  return { data: docs.map(toEntity), total };
}

export async function updateReview(
  id: string,
  input: {
    status: FeedbackStatus;
    adminNote: string;
    reviewedBy: string;
    reviewedAt: Date;
  },
): Promise<FeedbackEntity | null> {
  const doc = await Feedback.findByIdAndUpdate(
    id,
    {
      $set: {
        status: input.status,
        adminNote: input.adminNote,
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt,
      },
    },
    { new: true, runValidators: true },
  )
    .lean()
    .exec();

  return doc ? toEntity(doc) : null;
}

export async function findForExport(
  query: Omit<FeedbackQuery, "page" | "limit">,
): Promise<FeedbackAdminView[]> {
  const docs = await Feedback.find(buildFilter(query))
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return docs.map((doc) => toEntity(doc).toAdminView());
}

export async function deleteByUserId(userId: string): Promise<number> {
  const result = await Feedback.deleteMany({ userId }).exec();
  return result.deletedCount ?? 0;
}
