import { z } from "zod";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/server/utils/constants";

export const uploadMetadataSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export type UploadMetadataInput = z.infer<typeof uploadMetadataSchema>;
