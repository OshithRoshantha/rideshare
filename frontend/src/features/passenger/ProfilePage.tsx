import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LogOut, MapPin, Moon, Plus, Sun } from "lucide-react";
import { toast } from "sonner";

import { MapView } from "@/components/map/MapView";
import { StopMarker } from "@/components/map/StopMarker";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [label, setLabel] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute("data-theme") === "dark");

  const updateMutation = useMutation({
    mutationFn: async (saved_places: { label: string; name: string; lat: number; lng: number }[]) =>
      (await api.patch("/me", { saved_places })).data,
    onSuccess: (data) => {
      updateUser(data);
      toast.success("Saved place added");
      setShowAddPlace(false);
      setLabel("");
      setPlaceName("");
      setCoords(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setIsDark(!isDark);
  }

  async function handleMapClick(lat: number, lng: number) {
    setCoords({ lat, lng });
    const res = await api.get("/geo/reverse", { params: { lat, lng } });
    setPlaceName(res.data.name);
  }

  function savePlace() {
    if (!user || !label || !placeName || !coords) return;
    const places = [...user.saved_places.filter((p) => p.label !== label), { label, name: placeName, lat: coords.lat, lng: coords.lng }];
    updateMutation.mutate(places);
  }

  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.full_name} size={56} />
        <div>
          <h2 className="text-lg font-semibold">{user.full_name}</h2>
          <p className="text-sm text-text-secondary">{user.email}</p>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-semibold">Saved places</p>
          <Button size="sm" variant="secondary" onClick={() => setShowAddPlace(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {user.saved_places.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-input bg-surface p-3 text-sm">
              <MapPin className="h-4 w-4 text-text-muted" />
              <span className="font-medium">{p.label}:</span> {p.name}
            </div>
          ))}
          {user.saved_places.length === 0 && <p className="text-sm text-text-muted">No saved places yet.</p>}
        </div>
      </Card>

      <Card>
        <button onClick={toggleTheme} className="flex w-full items-center justify-between">
          <span className="font-medium">Dark mode</span>
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>
      </Card>

      <Button
        variant="secondary"
        onClick={() => {
          logout();
          queryClient.clear();
          navigate("/login");
        }}
      >
        <LogOut className="h-4 w-4" /> Log out
      </Button>

      <Modal open={showAddPlace} onClose={() => setShowAddPlace(false)} title="Add a saved place">
        <div className="flex flex-col gap-3">
          <Input label="Label" placeholder="e.g. Home, Office" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input label="Place name" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Tap the map to pick a location" />
          <div className="h-48 overflow-hidden rounded-input border border-border">
            <MapView center={coords ? [coords.lat, coords.lng] : [6.9271, 79.8612]} onMapClick={handleMapClick}>
              {coords && <StopMarker lat={coords.lat} lng={coords.lng} label={placeName || "Selected"} kind="origin" />}
            </MapView>
          </div>
          <Button fullWidth loading={updateMutation.isPending} disabled={!label || !placeName || !coords} onClick={savePlace}>
            Save place
          </Button>
        </div>
      </Modal>
    </div>
  );
}
