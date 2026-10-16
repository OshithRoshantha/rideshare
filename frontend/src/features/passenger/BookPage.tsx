import { useState } from "react";
import clsx from "clsx";

import { StepReview } from "@/features/passenger/booking/StepReview";
import { StepWhen } from "@/features/passenger/booking/StepWhen";
import { StepWhere } from "@/features/passenger/booking/StepWhere";

const STEPS = ["Where", "When", "Review"];

export default function BookPage() {
  const [step, setStep] = useState(0);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="mx-auto flex w-full max-w-xl items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={clsx(
                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i <= step ? "bg-accent text-white" : "bg-surface text-text-muted",
              )}
            >
              {i + 1}
            </div>
            <span className={clsx("text-sm font-medium", i === step ? "text-text-primary" : "text-text-muted")}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && <StepWhere onNext={() => setStep(1)} />}
        {step === 1 && <StepWhen onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <StepReview onBack={() => setStep(1)} />}
      </div>
    </div>
  );
}
