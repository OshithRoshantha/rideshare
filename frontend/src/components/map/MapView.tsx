import { type ReactNode } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  children?: ReactNode;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapView({ center, zoom = 12, children, onMapClick, className }: MapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} className={className} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {onMapClick && <ClickHandler onClick={onMapClick} />}
      {children}
    </MapContainer>
  );
}
