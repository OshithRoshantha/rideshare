import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function NotificationsList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<Notification[]>("/notifications")).data,
  });

  const readAllMutation = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notifications</h2>
        {!!data?.length && (
          <Button size="sm" variant="ghost" onClick={() => readAllMutation.mutate()}>
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}
      {!isLoading && data?.length === 0 && <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />}

      <div className="flex flex-col gap-2">
        {data?.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.read && markReadMutation.mutate(n.id)}
            className={`flex items-start gap-3 rounded-input border p-3.5 text-left ${
              n.read ? "border-border" : "border-accent/40 bg-accent-soft"
            }`}
          >
            {!n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-accent" />}
            <div className={n.read ? "ml-5" : ""}>
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-text-secondary">{n.body}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
