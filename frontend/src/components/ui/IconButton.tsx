import { type ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "default" | "ghost";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = "default", className, children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      className={clsx(
        "inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        variant === "default" ? "bg-surface hover:bg-border/50 shadow-soft" : "hover:bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";
