import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-[12px] font-medium text-ink-soft">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-card border bg-paper-raised px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink ${
            error ? "border-coral" : "border-line"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-[11px] text-coral">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";