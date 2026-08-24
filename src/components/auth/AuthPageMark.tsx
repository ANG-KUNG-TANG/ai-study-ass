export function AuthPageMark() {
  return (
    <div className="relative mx-auto mb-4 flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-ink shadow-[0_5px_14px_rgba(34,31,26,0.11)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[18px] w-[18px] text-paper"
        aria-hidden="true"
      >
        <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 9h8M8 13h5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute bottom-[5px] h-[2px] w-4 rounded-full bg-yellow" />
    </div>
  );
}
