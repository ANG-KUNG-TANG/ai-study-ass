import type { ReactNode } from "react";

export function AdminPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[8px] border border-line bg-paper-raised p-5 shadow-none",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
