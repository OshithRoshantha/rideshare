import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { api, apiErrorMessage } from "@/lib/api";

export default function OnboardingPage() {
  const [licenceNo, setLicenceNo] = useState("");
  const [nicNo, setNicNo] = useState("");
  const [vehicleType, setVehicleType] = useState<"van" | "bus">("van");
  const [seats, setSeats] = useState("14");
  const [plateNo, setPlateNo] = useState("");
  const [model, setModel] = useState("");
  const [colour, setColour] = useState("");

  const { data: driver, refetch } = useQuery({
    queryKey: ["driver", "me"],
    queryFn: async () => (await api.get("/driver/me")).data,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/driver/onboarding", {
          licence_no: licenceNo,
          nic_no: nicNo,
          vehicle: { type: vehicleType, seats: Number(seats), plate_no: plateNo, model, colour, has_ac: true },
        })
      ).data,
    onSuccess: () => {
      toast.success("Application submitted!");
      refetch();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (driver?.status === "pending" && driver.licence_no) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <Clock className="h-14 w-14 text-amber-500" />
        <h2 className="text-xl font-semibold">Waiting for approval</h2>
        <p className="text-text-secondary">We're reviewing your documents and vehicle details. You'll be notified once approved.</p>
      </div>
    );
  }

  if (driver?.status === "approved") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h2 className="text-xl font-semibold">You're approved!</h2>
        <p className="text-text-secondary">Set your availability to start receiving trips.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h2 className="text-xl font-semibold">Driver onboarding</h2>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text-secondary">Licence & NIC</p>
        <Input label="Driving licence number" value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} />
        <Input label="NIC number" value={nicNo} onChange={(e) => setNicNo(e.target.value)} />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text-secondary">Vehicle</p>
        <Segmented
          options={[
            { value: "van", label: "Van" },
            { value: "bus", label: "Bus" },
          ]}
          value={vehicleType}
          onChange={setVehicleType}
        />
        <Input label="Seats" type="number" value={seats} onChange={(e) => setSeats(e.target.value)} />
        <Input label="Plate number" value={plateNo} onChange={(e) => setPlateNo(e.target.value)} />
        <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} />
        <Input label="Colour" value={colour} onChange={(e) => setColour(e.target.value)} />
      </div>

      <Button
        fullWidth
        loading={mutation.isPending}
        disabled={!licenceNo || !nicNo || !plateNo || !model || !colour}
        onClick={() => mutation.mutate()}
      >
        Submit application
      </Button>
    </div>
  );
}
