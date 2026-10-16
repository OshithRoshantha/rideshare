import { Marker, Popup } from "react-leaflet";

import { destinationIcon, originIcon, stopIcon } from "@/components/map/icons";

interface StopMarkerProps {
  lat: number;
  lng: number;
  label: string;
  kind?: "stop" | "origin" | "destination";
}

export function StopMarker({ lat, lng, label, kind = "stop" }: StopMarkerProps) {
  const icon = kind === "origin" ? originIcon : kind === "destination" ? destinationIcon : stopIcon;
  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup>{label}</Popup>
    </Marker>
  );
}
