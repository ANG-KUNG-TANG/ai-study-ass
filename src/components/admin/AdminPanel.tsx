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
        "rounded-card border border-line bg-paper-raised p-5",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
