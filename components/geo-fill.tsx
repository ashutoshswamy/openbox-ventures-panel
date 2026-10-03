"use client";

import { LocateFixed } from "lucide-react";

// Fills the surrounding form's lat/lng inputs with the admin's current position.
export function GeoFill() {
  return (
    <button
      type="button"
      className="btn"
      onClick={(e) => {
        const form = e.currentTarget.form!;
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            (form.elements.namedItem("lat") as HTMLInputElement).value = coords.latitude.toFixed(6);
            (form.elements.namedItem("lng") as HTMLInputElement).value = coords.longitude.toFixed(6);
          },
          () => alert("Location access denied"),
          { enableHighAccuracy: true },
        );
      }}
    >
      <LocateFixed /> Use my location
    </button>
  );
}
