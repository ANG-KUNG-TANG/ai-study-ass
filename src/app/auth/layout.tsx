import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        backgroundImage:
          "radial-gradient(circle, #EFE8D6 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        backgroundColor: "#FAF6EC",
      }}
    >
      <div className="w-full max-w-[400px]">
        {/* Brand / Logo */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#221F1A]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#FAF6EC]">
              <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span className="absolute bottom-1 left-2 h-[2px] w-3 rounded-sm bg-[#FFCE3E]"></span>
          </div>
          <span className="font-serif text-xl font-semibold text-[#221F1A]">Recall</span>
        </div>

        {children}
      </div>
    </div>
  );
}