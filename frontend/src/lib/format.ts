import { format, parseISO } from "date-fns";

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  return `LKR ${rounded.toLocaleString("en-US")}`;
}

export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatWalkDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m walk`;
  return `${(m / 1000).toFixed(1)} km walk`;
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatDateLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "EEE, d MMM");
  } catch {
    return dateStr;
  }
}

export function formatDateFull(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "EEEE, d MMMM yyyy");
  } catch {
    return dateStr;
  }
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending match",
  confirmed: "Confirmed",
  unmatched: "Unmatched",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
  planned: "Planned",
  driver_accepted: "Accepted",
  in_progress: "In progress",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};
