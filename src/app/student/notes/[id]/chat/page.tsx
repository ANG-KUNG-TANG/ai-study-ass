"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { useNoteContext } from "@/context/NoteContext";
import { useChat } from "@/hooks/useChat";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/context/LanguageContext";

export default function ChatPage() {
  const { note } = useNoteContext();
  const { t } = useLanguage();
  const noteId = note?.id ?? "";

  const {
    messages,
    isLoading,
    isSending,
    isClearing,
    error,
    send,
    clear,
  } = useChat(noteId);

  const [question, setQuestion] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  if (!note) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    setQuestion("");
    await send(trimmed);
  }

  return (
    <div className="flex min-h-[620px] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {t("chat.document")}
          </p>
          <h2 className="mt-1 font-serif text-[20px] font-semibold">
            {t("chat.askAbout", { title: note.title })}
          </h2>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => void clear()}
            disabled={isClearing}
            className="flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-coral disabled:opacity-50"
          >
            <Trash2 size={14} />
            {isClearing ? t("chat.clearing") : t("chat.clear")}
          </button>
        )}
      </div>

      <Card className="flex min-h-[470px] flex-1 flex-col rounded-none border-x-0 bg-transparent px-0 sm:px-2">
        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          {isLoading && (
            <p className="text-[13px] text-ink-soft">
              {t("chat.loading")}
            </p>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
              <h3 className="font-serif text-[18px] font-semibold">
                {t("chat.start")}
              </h3>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
                {t("chat.startDescription")}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="space-y-3">
              <div className="ml-auto max-w-[82%] rounded-[8px] border-l-2 border-yellow bg-ink px-4 py-3 text-[13px] leading-relaxed text-paper-raised">
                {message.question}
              </div>

              <div className="max-w-[88%] border-l-2 border-line bg-line-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
                <p className="whitespace-pre-wrap">{message.answer}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-ink-faint">
                  {message.provider}
                </p>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="max-w-[88%] border-l-2 border-line bg-line-soft px-4 py-3 text-[13px] text-ink-soft">
              {t("chat.thinking")}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex items-end gap-2 border-t border-line pt-4"
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t("chat.placeholder")}
            rows={2}
            className="min-h-[46px] flex-1 resize-none rounded-[8px] border border-line bg-paper-raised px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-violet"
          />

          <Button
            type="submit"
            disabled={isSending || !question.trim()}
            aria-label={t("chat.send")}
          >
            <Send size={15} />
          </Button>
        </form>
      </Card>

      {error && <p className="text-[12px] text-coral">{error}</p>}
    </div>
  );
}
