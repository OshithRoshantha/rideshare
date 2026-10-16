import L from "leaflet";

function dotIcon(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export const stopIcon = dotIcon("#059669", 12);
export const originIcon = dotIcon("#2563EB", 18);
export const destinationIcon = dotIcon("#DC2626", 18);
export const vehicleIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#059669;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:16px;">🚐</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
