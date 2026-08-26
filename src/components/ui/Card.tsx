import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`relative rounded-[10px] border border-line bg-paper-raised p-5 shadow-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
