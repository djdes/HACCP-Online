"use client";

import { useEffect, useState } from "react";

const PROXIMITY_METERS = 50; // remind when within 50m

type AreaLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function GeoReminder({ areas }: { areas: AreaLocation[] }) {
  const [nearby, setNearby] = useState<AreaLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation || areas.length === 0) return;

    setWatching(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const close = areas.filter(
          (a) => haversine(latitude, longitude, a.lat, a.lng) <= PROXIMITY_METERS
        );
        setNearby(close);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 60000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [areas]);

  if (error) return null;
  if (!watching) return null;
  if (nearby.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
      <div className="font-medium">📍 Вы рядом с зоной уборки:</div>
      <ul className="mt-1 list-disc pl-4">
        {nearby.map((a) => (
          <li key={a.id}>{a.name}</li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] text-amber-600">
        Не забудьте отметить уборку в журнале!
      </p>
    </div>
  );
}
