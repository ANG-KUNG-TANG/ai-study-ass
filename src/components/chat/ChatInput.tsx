"use client";
import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-card border border-line bg-paper-raised p-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask a question about this note…"
        rows={1}
        className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] outline-none placeholder:text-ink-faint"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink text-paper transition-opacity disabled:opacity-30"
        aria-label="Send"
      >
        <Send size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}