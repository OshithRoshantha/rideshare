import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";

interface Settings {
  booking_fee_lkr: number;
  rate_per_km_van_lkr: number;
  rate_per_km_bus_lkr: number;
  minimum_fare_lkr: number;
  commission_pct: number;
  solo_ride_rate_per_km_lkr: number;
  max_walk_m: number;
  cutoff_time: string;
  min_seats_van: number;
  min_seats_bus: number;
  merge_window_min: number;
}

const WORKED_EXAMPLE_KM = [22, 22, 20, 19, 18, 17, 16, 15, 14, 14, 14, 13];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<Settings>("/admin/settings")).data,
  });
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (patch: Partial<Settings>) => (await api.patch("/admin/settings", patch)).data,
    onSuccess: () => {
      toast.success("Settings updated");
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !form) return <Skeleton className="h-96 w-full" />;

  function num(key: keyof Settings) {
    return {
      value: form![key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form!, [key]: Number(e.target.value) }),
    };
  }

  const distanceFares = WORKED_EXAMPLE_KM.map((km) => Math.round(km * form.rate_per_km_van_lkr));
  const totalDistanceFares = distanceFares.reduce((a, b) => a + b, 0);
  const totalBookingFees = form.booking_fee_lkr * WORKED_EXAMPLE_KM.length;
  const totalCollected = distanceFares.reduce((sum, df) => sum + Math.max(form.minimum_fare_lkr - form.booking_fee_lkr, df), 0) + totalBookingFees;
  const commission = Math.round(totalDistanceFares * (form.commission_pct / 100));
  const driverPayout = totalDistanceFares - commission;
  const companyRevenue = commission + totalBookingFees;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Card className="grid grid-cols-2 gap-4">
        <Input label="Booking fee (LKR)" type="number" {...num("booking_fee_lkr")} />
        <Input label="Van rate (LKR/km)" type="number" {...num("rate_per_km_van_lkr")} />
        <Input label="Bus rate (LKR/km)" type="number" {...num("rate_per_km_bus_lkr")} />
        <Input label="Minimum fare (LKR)" type="number" {...num("minimum_fare_lkr")} />
        <Input label="Commission (%)" type="number" {...num("commission_pct")} />
        <Input label="Solo ride rate (LKR/km)" type="number" {...num("solo_ride_rate_per_km_lkr")} />
        <Input label="Max walk distance (m)" type="number" {...num("max_walk_m")} />
        <Input label="Cut-off time" value={form.cutoff_time} onChange={(e) => setForm({ ...form, cutoff_time: e.target.value })} />
        <Input label="Min seats (van)" type="number" {...num("min_seats_van")} />
        <Input label="Min seats (bus)" type="number" {...num("min_seats_bus")} />
        <Input label="Merge window (min)" type="number" {...num("merge_window_min")} />
      </Card>

      <Button fullWidth loading={mutation.isPending} onClick={() => mutation.mutate(form)}>
        Save settings
      </Button>

      <Card>
        <p className="mb-3 font-semibold">Live preview — worked example (12 passengers)</p>
        <div className="flex flex-col gap-1 text-sm text-text-secondary">
          <Row label="Total collected" value={formatMoney(totalCollected)} />
          <Row label="Distance fares" value={formatMoney(totalDistanceFares)} />
          <Row label="Commission" value={formatMoney(commission)} />
          <Row label="Driver payout" value={formatMoney(driverPayout)} />
          <Row label="Company revenue" value={formatMoney(companyRevenue)} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
