import type { ChatMessage } from "@/types/chat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-card rounded-tr-sm bg-ink px-4 py-2.5 text-[13.5px] text-paper">
          {message.question}
        </div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[75%] rounded-card rounded-tl-sm border border-line bg-paper-raised px-4 py-2.5 text-[13.5px] leading-relaxed">
          {message.answer}
        </div>
      </div>
    </div>
  );
}