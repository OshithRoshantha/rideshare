import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";

interface Dashboard {
  bookings_total: number;
  confirmed: number;
  unmatched: number;
  trips: number;
  avg_occupancy_pct: number;
  revenue_lkr: number;
  driver_payouts_lkr: number;
  occupancy_by_corridor: { corridor_name: string; avg_occupancy_pct: number }[];
}

export default function DashboardPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard", date],
    queryFn: async () => (await api.get<Dashboard>("/admin/dashboard", { params: { date } })).data,
  });

  const matchMutation = useMutation({
    mutationFn: async () => (await api.post("/admin/matching/run", { date })).data as { trips_created: number; confirmed: number; unmatched: number; merged: number },
    onSuccess: (res) => {
      toast.success(`Matching complete: ${res.trips_created} trips, ${res.confirmed} confirmed, ${res.merged} merged, ${res.unmatched} unmatched`);
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-input border border-border px-3 text-sm" />
          <Button loading={matchMutation.isPending} onClick={() => matchMutation.mutate()}>
            Run matching for {date}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Bookings" value={data?.bookings_total ?? 0} />
          <Stat label="Confirmed" value={data?.confirmed ?? 0} />
          <Stat label="Unmatched" value={data?.unmatched ?? 0} />
          <Stat label="Trips" value={data?.trips ?? 0} />
          <Stat label="Avg occupancy" value={`${data?.avg_occupancy_pct ?? 0}%`} />
          <Stat label="Revenue" value={formatMoney(data?.revenue_lkr ?? 0)} />
          <Stat label="Driver payouts" value={formatMoney(data?.driver_payouts_lkr ?? 0)} />
        </div>
      )}

      <Card>
        <p className="mb-3 font-semibold">Occupancy by corridor</p>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data?.occupancy_by_corridor ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
              <XAxis dataKey="corridor_name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip />
              <Bar dataKey="avg_occupancy_pct" fill="#059669" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}
