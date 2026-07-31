"use client";

interface FlipCardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlipCard({ front, back, isFlipped, onFlip }: FlipCardProps) {
  return (
    <div className="mx-auto h-[260px] w-full max-w-[480px]" style={{ perspective: "1200px" }}>
      <button
        type="button"
        onClick={onFlip}
        aria-pressed={isFlipped}
        aria-label={isFlipped ? "Showing answer. Click to show question." : "Showing question. Click to show answer."}
        className="relative h-full w-full cursor-pointer rounded-card text-left transition-transform duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div
          className="absolute flex h-full w-full items-center justify-center rounded-card border border-line bg-paper-raised p-8 text-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-[16px] font-medium leading-snug">{front}</p>
        </div>
        <div
          className="absolute flex h-full w-full items-center justify-center rounded-card border border-ink bg-ink p-8 text-center text-paper"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-[15px] leading-relaxed">{back}</p>
        </div>
      </button>
    </div>
  );
}