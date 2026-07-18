import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export function Card({ children, className= "", ...props}: CardProps) {
    return (
        <div
         className={`rounded-card border border-line bg-paper-raised p-5 ${className}`}
         {...props}
         >
            {children}
         </div>
    )
}