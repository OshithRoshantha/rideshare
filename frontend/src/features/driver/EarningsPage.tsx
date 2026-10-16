import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatDateLabel, formatMoney } from "@/lib/format";

interface EarningsResponse {
  this_week: number;
  last_week: number;
  trips: { trip_id: string; date: string; passengers: number; payout: number; payout_status: string }[];
}

export default function EarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["driver-earnings"],
    queryFn: async () => (await api.get<EarningsResponse>("/driver/earnings")).data,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h2 className="text-xl font-semibold">Earnings</h2>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-sm text-text-secondary">This week</p>
          <p className="text-2xl font-bold text-accent">{formatMoney(data?.this_week ?? 0)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-text-secondary">Last week</p>
          <p className="text-2xl font-bold">{formatMoney(data?.last_week ?? 0)}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        {data?.trips.map((t) => (
          <Card key={t.trip_id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{formatDateLabel(t.date)}</p>
                <p className="text-sm text-text-secondary">{t.passengers} passengers</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(t.payout)}</p>
                <Badge status={t.payout_status === "completed" ? "confirmed" : "pending"} label={t.payout_status === "completed" ? "Paid" : "Pending"} />
              </div>
            </div>
          </Card>
        ))}
        {data?.trips.length === 0 && <p className="text-sm text-text-muted">No completed trips yet.</p>}
      </div>
    </div>
  );
}
