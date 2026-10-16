import { create } from "zustand";

export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteOption {
  corridor: { id: string; name: string; polyline: number[][] };
  direction: "inbound" | "outbound";
  pickup_stop: { id: string; name: string; lat: number; lng: number };
  drop_stop: { id: string; name: string; lat: number; lng: number };
  walk_to_pickup_m: number;
  walk_from_drop_m: number;
  passenger_km: number;
  fare_quote: {
    passenger_km: number;
    rate_per_km: number;
    booking_fee: number;
    distance_fare: number;
    fare: number;
    solo_estimate: number;
    savings_pct: number;
  };
  slots: {
    slot: { id: string; departure_time: string };
    eta_at_pickup: string;
    seats_booked: number;
    available: boolean;
  }[];
}

interface BookingDraftState {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  selectedOption: RouteOption | null;
  bookingType: "scheduled" | "repeat" | "now";
  date: string | null;
  repeatWeekdays: number[];
  repeatFrom: string | null;
  repeatTo: string | null;
  selectedSlotId: string | null;
  setPoints: (origin: GeoPoint | null, destination: GeoPoint | null) => void;
  setOption: (option: RouteOption | null) => void;
  setBookingType: (type: "scheduled" | "repeat" | "now") => void;
  setDate: (date: string | null) => void;
  setRepeat: (weekdays: number[], from: string, to: string) => void;
  setSlot: (slotId: string | null) => void;
  reset: () => void;
}

export const useBookingDraft = create<BookingDraftState>((set) => ({
  origin: null,
  destination: null,
  selectedOption: null,
  bookingType: "scheduled",
  date: null,
  repeatWeekdays: [1, 2, 3, 4, 5],
  repeatFrom: null,
  repeatTo: null,
  selectedSlotId: null,
  setPoints: (origin, destination) => set({ origin, destination, selectedOption: null }),
  setOption: (option) => set({ selectedOption: option, selectedSlotId: null }),
  setBookingType: (bookingType) => set({ bookingType }),
  setDate: (date) => set({ date }),
  setRepeat: (repeatWeekdays, repeatFrom, repeatTo) => set({ repeatWeekdays, repeatFrom, repeatTo }),
  setSlot: (selectedSlotId) => set({ selectedSlotId }),
  reset: () =>
    set({
      origin: null,
      destination: null,
      selectedOption: null,
      bookingType: "scheduled",
      date: null,
      selectedSlotId: null,
    }),
}));
