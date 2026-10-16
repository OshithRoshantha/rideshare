import clsx from "clsx";

const colorMap: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  unmatched: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-700",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-red-100 text-red-800",
  planned: "bg-slate-200 text-slate-700",
  driver_accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-red-100 text-red-800",
  default: "bg-surface text-text-secondary",
};

export function Badge({ status, label, className }: { status?: string; label: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        colorMap[status ?? "default"] ?? colorMap.default,
        className,
      )}
    >
      {label}
    </span>
  );
}
