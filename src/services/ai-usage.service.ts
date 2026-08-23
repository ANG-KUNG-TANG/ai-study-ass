import { apiFetch } from "@/lib/api";
import type { StudentAIUsage } from "@/types/ai-usage";

export function getStudentAIUsage():
Promise<StudentAIUsage> {
  return apiFetch<StudentAIUsage>(
    "/user/ai-usage",
  );
}
