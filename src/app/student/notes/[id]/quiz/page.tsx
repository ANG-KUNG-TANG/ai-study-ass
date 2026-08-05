"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { useQuiz } from "@/hooks/useQuiz";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function QuizPage() {
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
    return <p className="text-[13px] text-ink-soft">Loading quiz…</p>;
  }

  if (!quiz) {
    return (
      <Card className="flex min-h-[260px] flex-col items-center justify-center text-center">
        <h2 className="font-serif text-[18px] font-semibold">
          No quiz generated yet
        </h2>

        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
          Generate a quiz from the selected document. Questions will be based
          on its study notes and extracted content.
        </p>

        <Button
          className="mt-5"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating quiz…" : "Generate quiz"}
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
            Practice
          </p>
          <h2 className="mt-1 font-serif text-[20px] font-semibold">
            {quiz.questions.length}-question quiz
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
          {isGenerating ? "Regenerating" : "Regenerate"}
        </button>
      </div>

      {quiz.questions.map((question, index) => {
        const selectedAnswer = answers[question.id] ?? "";
        const isCorrect =
          submitted &&
          selectedAnswer.trim().toLowerCase() ===
            question.answer.trim().toLowerCase();

        return (
          <Card key={question.id}>
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F2EEE5] text-[12px] font-semibold">
                {index + 1}
              </span>

              <div>
                <h3 className="text-[14px] font-semibold leading-relaxed">
                  {question.question}
                </h3>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-faint">
                  {question.questionType.replaceAll("_", " ")}
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
                placeholder="Type your answer"
                className="w-full rounded-xl border border-[#E6DDC8] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#8C82C8]"
              />
            ) : (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E6DDC8] px-3 py-2.5 text-[13px] hover:bg-[#FBF8F1]"
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
                    ? "Correct"
                    : `Correct answer: ${question.answer}`}
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

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {score === null ? (
            <p className="text-[13px] text-ink-soft">
              Answer the questions and submit your quiz.
            </p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                Result
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
          {submitted ? "Submitted" : "Submit quiz"}
        </Button>
      </Card>

      {error && <p className="text-[12px] text-coral">{error}</p>}
    </div>
  );
}
