import { type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={clsx(
        "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        selected
          ? "border-accent bg-accent text-white"
          : "border-border bg-bg text-text-primary hover:bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
