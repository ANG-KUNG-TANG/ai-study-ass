"use client";

import {
  ArrowRight,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  GitBranch,
  Layers3,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

type Tool = "summary" | "flashcards" | "quiz" | "chat" | "graph";

const tools: { id: Tool; label: string; icon: typeof Sparkles }[] = [
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "flashcards", label: "Flashcards", icon: Layers3 },
  { id: "quiz", label: "Quiz", icon: CircleHelp },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "graph", label: "Knowledge Graph", icon: GitBranch },
];

const flashcards = [
  {
    question: "What is active recall?",
    answer:
      "A learning technique that involves retrieving information from memory instead of simply rereading it.",
  },
  {
    question: "Why does spaced repetition help?",
    answer:
      "It revisits information at intervals, helping strengthen long-term memory.",
  },
  {
    question: "What is the forgetting curve?",
    answer:
      "A model describing how memory retention can decline over time without review.",
  },
];

const quizQuestion = {
  question: "Which technique asks you to retrieve information from memory?",
  options: [
    "Passive rereading",
    "Active recall",
    "Highlighting every sentence",
  ],
  correct: 1,
};

const responses: Record<string, string> = {
  "what is active recall":
    "Active recall means trying to retrieve information from memory without looking at the answer first.",
  "why spaced repetition":
    "Spaced repetition schedules reviews over time. It helps you revisit material before it becomes too difficult to remember.",
  "how do they work together":
    "Active recall strengthens retrieval. Spaced repetition helps you practise that retrieval across multiple study sessions.",
};

export function StudyDemo() {
  const [activeTool, setActiveTool] = useState<Tool>("summary");
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Hi! Ask me about active recall, spaced repetition, or how they work together.",
    },
  ]);

  function sendMessage() {
    const question = chatInput.trim();
    if (!question) return;

    const normalized = question.toLowerCase();
    let response =
      "This sample chat uses prepared answers. Try asking about active recall, spaced repetition, or how they work together.";

    if (normalized.includes("active recall")) {
      response = responses["what is active recall"];
    } else if (normalized.includes("spaced repetition")) {
      response = responses["why spaced repetition"];
    } else if (
      normalized.includes("together") ||
      normalized.includes("relationship")
    ) {
      response = responses["how do they work together"];
    }

    setChatMessages((messages) => [
      ...messages,
      { role: "user", text: question },
      { role: "assistant", text: response },
    ]);
    setChatInput("");
  }

  return (
    <div className="w-full">
      {/* Tool navigation */}
      <div
        className="flex gap-1 overflow-x-auto border-b border-line pb-3"
        role="tablist"
        aria-label="Study tools"
      >
        {tools.map(({ id, label, icon: Icon }) => {
          const active = activeTool === id;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTool(id)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-200 ${
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-line-soft hover:text-ink"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Active tool */}
      <div
        key={activeTool}
        role="tabpanel"
        className="min-h-[280px] animate-in fade-in duration-300"
      >
        {activeTool === "summary" && (
          <div className="space-y-5 px-1 py-5 sm:px-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-coral">
                <Sparkles size={15} />
                Sample study summary
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">
                Learn smarter, not just longer
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Effective learning depends on how you practise retrieving and
                revisiting information—not simply how long you look at it.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl bg-yellow-soft/50 p-4">
                <h4 className="text-sm font-semibold text-ink">
                  Active recall
                </h4>
                <p className="mt-1.5 text-xs leading-5 text-ink-soft">
                  Close your notes and explain the idea from memory.
                </p>
              </article>
              <article className="rounded-xl bg-sage-soft/60 p-4">
                <h4 className="text-sm font-semibold text-ink">
                  Spaced repetition
                </h4>
                <p className="mt-1.5 text-xs leading-5 text-ink-soft">
                  Review important ideas across multiple study sessions.
                </p>
              </article>
            </div>

            <p className="rounded-lg border border-line px-3 py-2.5 text-xs leading-5 text-ink-soft">
              <strong className="text-ink">Key takeaway:</strong> Retrieve
              information actively, then revisit it over time.
            </p>
          </div>
        )}

        {activeTool === "flashcards" && (
          <div className="px-1 py-5 sm:px-2">
            <div className="mb-3 flex items-center justify-between text-xs text-ink-soft">
              <span>Learning cards</span>
              <span>
                {cardIndex + 1} of {flashcards.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAnswer((value) => !value)}
              className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-line bg-yellow-soft/30 p-6 text-center transition-colors duration-200 hover:bg-yellow-soft/50"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-coral">
                {showAnswer ? "Answer" : "Question"}
              </span>
              <span className="mt-4 max-w-md text-base font-semibold leading-7 text-ink">
                {showAnswer
                  ? flashcards[cardIndex].answer
                  : flashcards[cardIndex].question}
              </span>
              <span className="mt-4 text-xs text-ink-soft">
                {showAnswer
                  ? "Tap to see the question"
                  : "Tap to reveal answer"}
              </span>
            </button>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setCardIndex((index) =>
                    index === 0 ? flashcards.length - 1 : index - 1,
                  );
                  setShowAnswer(false);
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:bg-line-soft"
              >
                <ChevronLeft size={15} />
                Previous
              </button>

              <button
                type="button"
                onClick={() => {
                  setCardIndex((index) => (index + 1) % flashcards.length);
                  setShowAnswer(false);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-yellow px-4 py-2 text-xs font-semibold text-ink transition-transform hover:-translate-y-0.5"
              >
                Next card
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {activeTool === "quiz" && (
          <div className="px-1 py-5 sm:px-2">
            <div className="flex items-center gap-2 text-xs font-medium text-coral">
              <CircleHelp size={15} />
              Quick knowledge check
            </div>

            <h3 className="mt-4 text-sm font-semibold leading-6 text-ink">
              {quizQuestion.question}
            </h3>

            <div className="mt-4 space-y-2">
              {quizQuestion.options.map((option, index) => {
                const selected = selectedAnswer === index;
                const correct = index === quizQuestion.correct;

                let optionClass =
                  "border-line bg-paper-raised hover:border-ink/30";

                if (selected && correct) {
                  optionClass = "border-sage bg-sage-soft";
                } else if (selected && !correct) {
                  optionClass = "border-coral bg-coral/5";
                } else if (selectedAnswer !== null && correct) {
                  optionClass = "border-sage bg-sage-soft";
                }

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={selectedAnswer !== null}
                    onClick={() => setSelectedAnswer(index)}
                    className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs transition-colors ${optionClass}`}
                  >
                    <span className="text-ink">{option}</span>
                    {selectedAnswer !== null && correct && (
                      <Check size={15} className="shrink-0 text-sage" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs leading-5 ${
                  selectedAnswer === quizQuestion.correct
                    ? "bg-sage-soft text-ink"
                    : "bg-yellow-soft text-ink"
                }`}
              >
                <strong>
                  {selectedAnswer === quizQuestion.correct
                    ? "Correct!"
                    : "Not quite."}
                </strong>{" "}
                Active recall means retrieving information from memory.
                {selectedAnswer !== quizQuestion.correct &&
                  " Try again with another question after resetting."}
                <button
                  type="button"
                  onClick={() => setSelectedAnswer(null)}
                  className="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {activeTool === "chat" && (
          <div className="px-1 py-4 sm:px-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-coral/10 text-coral">
                <Bot size={17} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Study assistant
                </h3>
                <p className="text-[10px] text-ink-faint">
                  Sample conversation · local demo
                </p>
              </div>
            </div>

            <div
              className="max-h-[220px] min-h-[160px] space-y-3 overflow-y-auto rounded-xl bg-line-soft/40 p-3"
              aria-live="polite"
            >
              {chatMessages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-xs leading-5 ${
                      message.role === "user"
                        ? "rounded-br-sm bg-ink text-paper"
                        : "rounded-bl-sm border border-line bg-paper-raised text-ink"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask about the study note..."
                aria-label="Ask the sample study assistant"
                className="min-w-0 flex-1 rounded-full border border-line bg-paper-raised px-4 py-2.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!chatInput.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow text-ink transition-opacity hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        )}

        {activeTool === "graph" && (
          <div className="px-1 py-5 sm:px-2">
            <div className="flex items-center gap-2 text-xs font-medium text-coral">
              <GitBranch size={15} />
              Concept connections
            </div>

            <h3 className="mt-3 text-sm font-semibold text-ink">
              How learning techniques connect
            </h3>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Select a concept to explore its relationship to the others.
            </p>

            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              <div className="space-y-3">
                <div className="rounded-xl border border-coral/20 bg-coral/5 p-3 text-center">
                  <p className="text-xs font-semibold text-ink">
                    Active recall
                  </p>
                  <p className="mt-1 text-[10px] text-ink-soft">
                    Retrieve from memory
                  </p>
                </div>
                <div className="rounded-xl border border-sage/30 bg-sage-soft/60 p-3 text-center">
                  <p className="text-xs font-semibold text-ink">
                    Spaced repetition
                  </p>
                  <p className="mt-1 text-[10px] text-ink-soft">
                    Review over time
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 text-ink-faint">
                <ArrowRight size={18} />
                <span className="text-[9px]">support</span>
                <ArrowRight size={18} />
              </div>

              <div className="rounded-xl border border-yellow/60 bg-yellow-soft/60 p-4 text-center">
                <Sparkles size={20} className="mx-auto text-ink" />
                <p className="mt-2 text-xs font-semibold text-ink">
                  Long-term memory
                </p>
                <p className="mt-1 text-[10px] leading-4 text-ink-soft">
                  Stronger retention
                </p>
              </div>
            </div>

            <p className="mt-5 rounded-xl bg-line-soft/50 px-3 py-2.5 text-xs leading-5 text-ink-soft">
              <strong className="text-ink">Connection:</strong> Active recall
              practises retrieval, while spaced repetition schedules further
              practice to support retention.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
