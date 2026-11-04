"use client";

import { LocateFixed } from "lucide-react";
import { sileo } from "sileo";

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
            sileo.success({ title: "Location filled" });
          },
          () => sileo.warning({ title: "Location access denied", description: "Allow location in your browser to use this." }),
          { enableHighAccuracy: true },
        );
      }}
    >
      <LocateFixed /> Use my location
    </button>
  );
}
