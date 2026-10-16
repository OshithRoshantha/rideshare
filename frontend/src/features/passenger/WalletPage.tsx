import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";

interface Transaction {
  id: string;
  type: string;
  amount_lkr: number;
  status: string;
  note: string;
  created_at: string;
}

const AMOUNTS = [500, 1000, 2000];

export default function WalletPage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [customAmount, setCustomAmount] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => (await api.get("/wallet")).data as { balance: number; transactions: Transaction[] },
  });

  const topupMutation = useMutation({
    mutationFn: async (amount: number) => (await api.post("/wallet/topup", { amount_lkr: amount })).data,
    onSuccess: (res) => {
      toast.success(`Added ${formatMoney(res.transaction.amount_lkr)} to your wallet`);
      updateUser({ wallet_balance_lkr: res.balance });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setCustomAmount("");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h2 className="text-xl font-semibold">Wallet</h2>

      <Card className="bg-accent-soft">
        <p className="text-sm text-text-secondary">Balance</p>
        {isLoading ? <Skeleton className="mt-1 h-9 w-32" /> : <p className="text-3xl font-bold text-accent">{formatMoney(data?.balance ?? 0)}</p>}
      </Card>

      <Card>
        <p className="mb-3 font-semibold">Top up</p>
        <div className="flex flex-wrap gap-2">
          {AMOUNTS.map((a) => (
            <Chip key={a} onClick={() => topupMutation.mutate(a)}>
              {formatMoney(a)}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input placeholder="Custom amount" value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))} />
          <Button
            loading={topupMutation.isPending}
            disabled={!customAmount}
            onClick={() => topupMutation.mutate(Number(customAmount))}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-3 font-semibold">Transactions</p>
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data?.transactions.length === 0 && <p className="text-sm text-text-muted">No transactions yet.</p>}
        <div className="flex flex-col gap-3">
          {data?.transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 text-sm">
              {t.type === "topup" || t.type === "refund" ? (
                <ArrowDownCircle className="h-5 w-5 flex-shrink-0 text-success" />
              ) : (
                <ArrowUpCircle className="h-5 w-5 flex-shrink-0 text-danger" />
              )}
              <div className="flex-1">
                <p className="font-medium capitalize">{t.type.replace("_", " ")}</p>
                <p className="text-xs text-text-secondary">{t.note}</p>
              </div>
              <p className={t.type === "topup" || t.type === "refund" ? "font-semibold text-success" : "font-semibold text-danger"}>
                {t.type === "topup" || t.type === "refund" ? "+" : "-"}
                {formatMoney(t.amount_lkr)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
