import { apiFetch } from "@/lib/api";
import type { Quiz, GenerateQuizOptions } from "@/types/quiz";

export function generateQuiz(noteId: string, options: GenerateQuizOptions = {}): Promise<Quiz> {
  return apiFetch<Quiz>("/quiz/generate", {
    method: "POST",
    body: JSON.stringify({ noteId, ...options }),
  });
}

export function listQuizzesByNote(noteId: string): Promise<Quiz[]> {
  return apiFetch<Quiz[]>(`/quiz/note/${noteId}`);
}

export function deleteQuiz(id: string): Promise<void> {
  return apiFetch<void>(`/quiz/${id}`, { method: "DELETE" });
}