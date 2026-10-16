import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ChevronDown, MapPin, Wallet } from "lucide-react";
import clsx from "clsx";

import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/config";
import { formatMoney } from "@/lib/format";

const FAQS = [
  {
    q: "How does the shared ride work?",
    a: "We group passengers heading the same direction along the same main road into one AC van or bus, departing at a fixed time slot. You only pay for the distance you travel.",
  },
  {
    q: "What if there aren't enough riders for my slot?",
    a: "We'll try to merge you into a nearby time slot. If that's not possible, you're automatically refunded and notified — no questions asked.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes, free of charge any time before 9 PM the day before your ride. After that, the booking is locked in to secure the vehicle.",
  },
  {
    q: "Is it safe and comfortable?",
    a: "All our vehicles are air-conditioned and drivers are verified and rated by passengers after every trip.",
  },
];

export default function LandingPage() {
  const [km, setKm] = useState(15);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const tukCost = km * 100 * 22;
  const rideShareCost = Math.max(150, 20 + km * 18) * 22;
  const staffVanCost = 8000;

  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-content items-center justify-between px-4 py-5 md:px-8">
        <span className="text-xl font-bold text-accent">{APP_NAME}</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Log in
          </Link>
          <Link to="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-content px-4 pb-16 pt-10 text-center md:px-8 md:pt-16">
        <h1 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          Your daily office ride.
          <br />
          Shared, comfortable, pay only when you travel.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-text-secondary">
          Book a seat on an AC van or bus along your usual route in Colombo — split between everyone heading the same way.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register">
            <Button size="lg">Book a seat</Button>
          </Link>
          <Link to="/register">
            <Button size="lg" variant="secondary">
              Drive with us
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 pb-16 md:px-8">
        <h2 className="mb-8 text-center text-2xl font-semibold">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: MapPin, title: "Tell us your route", desc: "Search your home and office — we match you to the nearest corridor and stop." },
            { icon: CalendarCheck, title: "Pick a time slot", desc: "Choose a departure time that fits your schedule, once or every weekday." },
            { icon: Wallet, title: "Pay only your share", desc: "Fares are based on distance travelled — see the exact price before you confirm." },
          ].map((step, i) => (
            <div key={i} className="rounded-card border border-border p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold">{step.title}</h3>
              <p className="text-sm text-text-secondary">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-content px-4 md:px-8">
          <h2 className="mb-8 text-center text-2xl font-semibold">See how much you could save</h2>
          <div className="mx-auto max-w-md rounded-card border border-border bg-bg p-6 shadow-soft">
            <label className="mb-2 block text-sm font-medium">Your one-way commute distance</label>
            <input
              type="range"
              min={2}
              max={30}
              value={km}
              onChange={(e) => setKm(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <p className="mb-6 text-sm text-text-secondary">{km} km one way</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-input bg-surface px-4 py-3">
                <span className="text-sm">Solo tuk / taxi (monthly)</span>
                <span className="font-semibold">{formatMoney(tukCost)}</span>
              </div>
              <div className="flex items-center justify-between rounded-input border-2 border-accent bg-accent-soft px-4 py-3">
                <span className="text-sm font-medium text-accent">RideShare Route (monthly)</span>
                <span className="font-bold text-accent">{formatMoney(rideShareCost)}</span>
              </div>
              <div className="flex items-center justify-between rounded-input bg-surface px-4 py-3">
                <span className="text-sm">Private staff van (monthly)</span>
                <span className="font-semibold">{formatMoney(staffVanCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 py-16 md:px-8">
        <h2 className="mb-8 text-center text-2xl font-semibold">Corridors currently served</h2>
        <div className="grid gap-4 text-center sm:grid-cols-3">
          {["Kadawatha → Colombo Fort", "Maharagama → Kollupitiya", "Malabe → Colombo 07"].map((name) => (
            <div key={name} className="rounded-card border border-border p-5 font-medium">
              {name}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 py-16 md:px-8">
        <h2 className="mb-8 text-center text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mx-auto max-w-xl divide-y divide-border rounded-card border border-border">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left font-medium"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {faq.q}
                <ChevronDown className={clsx("h-4 w-4 transition-transform", openFaq === i && "rotate-180")} />
              </button>
              {openFaq === i && <p className="px-5 pb-4 text-sm text-text-secondary">{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-text-secondary">
        © {new Date().getFullYear()} {APP_NAME}. Made for Colombo's daily commuters.
      </footer>
    </div>
  );
}
