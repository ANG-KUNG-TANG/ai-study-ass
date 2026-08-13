"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { useFlashcards } from "@/hooks/useFlashcards";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { FlashcardDifficulty } from "@/types/flashcard";

export default function FlashcardPage() {
  const { note } = useNoteContext();
  const noteId = note?.id ?? "";

  const {
    flashcards,
    isLoading,
    isRating,
    error,
    rate,
  } = useFlashcards(noteId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setRevealed(false);
  }, [flashcards.length]);

  if (!note) return null;

  async function handleRate(difficulty: FlashcardDifficulty) {
    const card = flashcards[currentIndex];

    if (!card) return;

    await rate(card.id, difficulty);
    setRevealed(false);

    setCurrentIndex((current) =>
      flashcards.length > 1
        ? (current + 1) % flashcards.length
        : current,
    );
  }

  if (isLoading) {
    return (
      <p className="text-[13px] text-ink-soft">
        Loading flashcards…
      </p>
    );
  }

  if (flashcards.length === 0) {
    return (
      <Card className="flex min-h-[260px] flex-col items-center justify-center text-center">
        <h2 className="font-serif text-[18px] font-semibold">
          Flashcards are not available yet
        </h2>

        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
          Flashcards are generated automatically with the other study
          materials.
        </p>

        <p className="mt-4 max-w-md text-[12px] leading-relaxed text-ink-faint">
          Use &quot;Regenerate all study materials&quot; in the generation
          status panel if generation needs to be retried.
        </p>

        {error && (
          <p className="mt-3 text-[12px] text-coral">
            {error}
          </p>
        )}
      </Card>
    );
  }

  const card = flashcards[currentIndex];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Review deck
        </p>

        <h2 className="mt-1 font-serif text-[20px] font-semibold">
          Card {currentIndex + 1} of {flashcards.length}
        </h2>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        className="block w-full text-left"
      >
        <Card className="flex min-h-[320px] flex-col items-center justify-center text-center transition hover:shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {revealed ? "Answer" : "Question"}
          </p>

          <p className="mt-5 max-w-2xl font-serif text-[22px] leading-relaxed">
            {revealed ? card.back : card.front}
          </p>

          <p className="mt-6 text-[12px] text-ink-faint">
            {revealed
              ? "Rate how difficult this card was."
              : "Click the card to reveal the answer."}
          </p>
        </Card>
      </button>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setCurrentIndex((current) =>
              current === 0 ? flashcards.length - 1 : current - 1,
            );
            setRevealed(false);
          }}
          className="flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink"
        >
          <ChevronLeft size={15} />
          Previous
        </button>

        {revealed && (
          <div className="flex flex-wrap justify-center gap-2">
            {(["easy", "medium", "hard"] as const).map((difficulty) => (
              <Button
                key={difficulty}
                onClick={() => handleRate(difficulty)}
                disabled={isRating}
              >
                {difficulty[0].toUpperCase() + difficulty.slice(1)}
              </Button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setCurrentIndex(
              (current) => (current + 1) % flashcards.length,
            );
            setRevealed(false);
          }}
          className="flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink"
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>

      {error && (
        <p className="text-[12px] text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
