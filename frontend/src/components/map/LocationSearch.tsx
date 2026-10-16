import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { api } from "@/lib/api";

export interface GeoResult {
  name: string;
  display_name: string;
  lat: number;
  lng: number;
}

interface LocationSearchProps {
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: GeoResult) => void;
}

export function LocationSearch({ placeholder, value, onChange, onSelect }: LocationSearchProps) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<GeoResult[]>("/geo/search", { params: { q: value } });
        setResults(res.data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="h-11 w-full rounded-input border border-border bg-bg pl-9 pr-9 text-base placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-input border border-border bg-bg shadow-soft">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-surface"
                onMouseDown={() => {
                  onSelect(r);
                  setOpen(false);
                }}
              >
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
                <span>
                  <span className="block font-medium text-text-primary">{r.name}</span>
                  <span className="block text-xs text-text-secondary">{r.display_name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
