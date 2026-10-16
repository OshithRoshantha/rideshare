import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney, formatTime12h, STATUS_LABELS } from "@/lib/format";
import { Ticket } from "lucide-react";

interface Trip {
  id: string;
  date: string;
  status: string;
  corridor_id: string;
  driver_name: string | null;
  vehicle: { plate_no: string; model: string } | null;
  booking_ids: string[];
  totals: { passengers: number; driver_payout: number; company_revenue: number };
}

interface Booking {
  id: string;
  date: string;
  status: string;
  corridor_id: string;
  passenger_id: string;
}

export default function TripsBookingsPage() {
  const [tab, setTab] = useState<"trips" | "bookings">("trips");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const queryClient = useQueryClient();

  const { data: trips } = useQuery({
    queryKey: ["admin-trips", date],
    queryFn: async () => (await api.get<Trip[]>("/admin/trips", { params: { date } })).data,
    enabled: tab === "trips",
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-bookings", date],
    queryFn: async () => (await api.get<Booking[]>("/admin/bookings", { params: { date } })).data,
    enabled: tab === "bookings",
  });

  const cancelMutation = useMutation({
    mutationFn: async (tripId: string) => (await api.patch(`/admin/trips/${tripId}`, { status: "cancelled" })).data,
    onSuccess: () => {
      toast.success("Trip cancelled");
      queryClient.invalidateQueries({ queryKey: ["admin-trips"] });
      setSelectedTrip(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trips & Bookings</h2>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-input border border-border px-3 text-sm" />
      </div>
      <Tabs
        tabs={[
          { value: "trips", label: "Trips" },
          { value: "bookings", label: "Bookings" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "trips" && (
        <>
          {trips?.length === 0 && <EmptyState icon={Ticket} title="No trips for this date" />}
          <div className="grid gap-3 md:grid-cols-2">
            {trips?.map((trip) => (
              <button key={trip.id} onClick={() => setSelectedTrip(trip)} className="text-left">
                <Card className="hover:bg-surface">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{trip.driver_name ?? "Unassigned"}</p>
                    <Badge status={trip.status} label={STATUS_LABELS[trip.status] ?? trip.status} />
                  </div>
                  <p className="text-sm text-text-secondary">{trip.vehicle?.model} · {trip.vehicle?.plate_no}</p>
                  <p className="mt-1 text-sm">
                    {trip.totals.passengers} passengers · {formatMoney(trip.totals.driver_payout)} payout
                  </p>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "bookings" && (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-text-secondary">
              <tr>
                <th className="px-4 py-2">Booking</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings?.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{b.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    <Badge status={b.status} label={STATUS_LABELS[b.status] ?? b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings?.length === 0 && <p className="p-4 text-sm text-text-muted">No bookings for this date.</p>}
        </div>
      )}

      <BottomSheet open={!!selectedTrip} onClose={() => setSelectedTrip(null)}>
        {selectedTrip && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">Trip detail</h3>
            <p className="text-sm text-text-secondary">Driver: {selectedTrip.driver_name ?? "Unassigned"}</p>
            <p className="text-sm text-text-secondary">{selectedTrip.booking_ids.length} bookings</p>
            <div className="rounded-input bg-surface p-3 text-sm">
              <p>Passengers: {selectedTrip.totals.passengers}</p>
              <p>Driver payout: {formatMoney(selectedTrip.totals.driver_payout)}</p>
              <p>Company revenue: {formatMoney(selectedTrip.totals.company_revenue)}</p>
            </div>
            {["planned", "driver_accepted"].includes(selectedTrip.status) && (
              <Button variant="danger" fullWidth loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate(selectedTrip.id)}>
                Cancel trip
              </Button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
