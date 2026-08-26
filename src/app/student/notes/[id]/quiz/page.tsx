"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { useQuiz } from "@/hooks/useQuiz";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/context/LanguageContext";

export default function QuizPage() {
  const { t } = useLanguage();
  const { note } = useNoteContext();
  const noteId = note?.id ?? "";

  const {
    quiz,
    isLoading,
    isGenerating,
    error,
    generate,
  } = useQuiz(noteId);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    if (!quiz || !submitted) return null;

    return quiz.questions.reduce((total, question) => {
      const given = (answers[question.id] ?? "").trim().toLowerCase();
      const expected = question.answer.trim().toLowerCase();
      return total + (given === expected ? 1 : 0);
    }, 0);
  }, [answers, quiz, submitted]);

  if (!note) return null;

  async function handleGenerate() {
    setAnswers({});
    setSubmitted(false);

    await generate({
      questionCount: 10,
      questionTypes: ["multiple_choice", "true_false"],
      dropInvalidQuestions: true,
    });
  }

  if (isLoading) {
    return <p className="text-[13px] text-ink-soft">{t("quiz.loading")}</p>;
  }

  if (!quiz) {
    return (
      <Card className="flex min-h-[260px] flex-col items-center justify-center rounded-none border-x-0 text-center">
        <h2 className="font-serif text-[18px] font-semibold">
          {t("quiz.unavailable")}
        </h2>

        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
          {t("quiz.generateDescription")}
        </p>

        <Button
          className="mt-5"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? t("quiz.generating") : t("quiz.generate")}
        </Button>

        {error && (
          <p className="mt-3 text-[12px] text-coral">{error}</p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("quiz.practice")}
          </p>
          <h2 className="mt-1 font-serif text-[20px] font-semibold">
            {t("quiz.questionCount", { count: quiz.questions.length })}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={isGenerating ? "animate-spin" : ""}
          />
          {isGenerating ? t("quiz.regenerating") : t("quiz.regenerate")}
        </button>
      </div>

      {quiz.questions.map((question, index) => {
        const selectedAnswer = answers[question.id] ?? "";
        const isCorrect =
          submitted &&
          selectedAnswer.trim().toLowerCase() ===
            question.answer.trim().toLowerCase();

        return (
          <Card key={question.id} className="rounded-none border-x-0 bg-transparent px-0 sm:px-2">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line-soft text-[12px] font-semibold">
                {index + 1}
              </span>

              <div>
                <h3 className="text-[14px] font-semibold leading-relaxed">
                  {question.question}
                </h3>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-faint">
                  {question.questionType === "multiple_choice"
                    ? t("quiz.type.multipleChoice")
                    : question.questionType === "true_false"
                      ? t("quiz.type.trueFalse")
                      : question.questionType === "short_answer"
                        ? t("quiz.type.shortAnswer")
                        : String(question.questionType).replaceAll("_", " ")}
                </p>
              </div>
            </div>

            {question.questionType === "short_answer" ? (
              <input
                value={selectedAnswer}
                disabled={submitted}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: event.target.value,
                  }))
                }
                placeholder={t("quiz.typeAnswer")}
                className="w-full rounded-[8px] border border-line bg-paper-raised px-3 py-2 text-[13px] outline-none focus:border-violet"
              />
            ) : (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 text-[13px] first:border-t hover:bg-paper-raised"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={selectedAnswer === option}
                      disabled={submitted}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: option,
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}

            {submitted && (
              <div
                className={`mt-4 rounded-xl p-3 text-[12px] ${
                  isCorrect
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={14} />
                  {isCorrect
                    ? t("quiz.correct")
                    : t("quiz.correctAnswer", { answer: question.answer })}
                </div>

                {question.explanation && (
                  <p className="mt-1 leading-relaxed">
                    {question.explanation}
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <Card className="flex flex-wrap items-center justify-between gap-3 rounded-none border-x-0 bg-transparent px-0">
        <div>
          {score === null ? (
            <p className="text-[13px] text-ink-soft">
              {t("quiz.instructions")}
            </p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                {t("quiz.result")}
              </p>
              <p className="font-serif text-[20px] font-semibold">
                {score} / {quiz.questions.length}
              </p>
            </>
          )}
        </div>

        <Button
          onClick={() => setSubmitted(true)}
          disabled={submitted || quiz.questions.length === 0}
        >
          {submitted ? t("quiz.submitted") : t("quiz.submit")}
        </Button>
      </Card>

      {error && <p className="text-[12px] text-coral">{error}</p>}
    </div>
  );
}
