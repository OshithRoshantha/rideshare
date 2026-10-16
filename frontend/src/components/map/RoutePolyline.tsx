import { Polyline } from "react-leaflet";

export function RoutePolyline({ points, dashed }: { points: [number, number][]; dashed?: boolean }) {
  if (!points.length) return null;
  return (
    <Polyline
      positions={points}
      pathOptions={{
        color: "#059669",
        weight: dashed ? 2 : 4,
        opacity: dashed ? 0.6 : 0.85,
        dashArray: dashed ? "6 6" : undefined,
      }}
    />
  );
}
