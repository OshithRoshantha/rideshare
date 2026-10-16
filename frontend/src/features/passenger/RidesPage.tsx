import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import { formatDateLabel, formatMoney, STATUS_LABELS } from "@/lib/format";

interface Booking {
  id: string;
  date: string;
  status: string;
  direction: string;
  fare_snapshot: { fare: number };
  corridor?: { name: string };
  pickup_stop?: { name: string };
  drop_stop?: { name: string };
}

export default function RidesPage() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", scope],
    queryFn: async () => (await api.get<Booking[]>("/bookings", { params: { scope } })).data,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h2 className="text-xl font-semibold">My Rides</h2>
      <Tabs
        tabs={[
          { value: "upcoming", label: "Upcoming" },
          { value: "past", label: "Past" },
        ]}
        value={scope}
        onChange={setScope}
      />

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <EmptyState icon={Ticket} title={`No ${scope} rides`} description="Your rides will show up here." />
      )}

      <div className="flex flex-col gap-3">
        {data?.map((b) => (
          <Link key={b.id} to={`/app/rides/${b.id}`}>
            <Card className="transition-shadow hover:shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{b.corridor?.name}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDateLabel(b.date)} · {b.pickup_stop?.name} → {b.drop_stop?.name}
                  </p>
                </div>
                <Badge status={b.status} label={STATUS_LABELS[b.status] ?? b.status} />
              </div>
              <p className="mt-2 text-sm font-medium">{formatMoney(b.fare_snapshot.fare)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
