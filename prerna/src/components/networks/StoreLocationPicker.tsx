"use client";

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import L from 'leaflet';

// Fix for default marker icon not showing
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface StoreLocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelectAction: (location: { lat: number; lng: number }) => void;
}

function FixedMarker({ marker }: { marker: { lat: number; lng: number } }) {
  return <Marker position={[marker.lat, marker.lng]} />;
}

export function StoreLocationPicker({ initialLocation, onLocationSelectAction }: StoreLocationPickerProps) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | undefined>(initialLocation);
  const [loading, setLoading] = useState(false);
  const [locationAsked, setLocationAsked] = useState(false);

  // On mount, ask for geolocation if no initialLocation
  useEffect(() => {
    if (!initialLocation && !locationAsked) {
      setLoading(true);
      setLocationAsked(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setMarker({ lat: latitude, lng: longitude });
            onLocationSelectAction({ lat: latitude, lng: longitude });
            setLoading(false);
          },
          () => setLoading(false)
        );
      } else {
        setLoading(false);
      }
    }
  }, [initialLocation, locationAsked, onLocationSelectAction]);

  // Map click handler
  function MapClickHandler() {
    useMapEvents({
      click: (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        setMarker({ lat, lng });
        onLocationSelectAction({ lat, lng });
      },
    });
    return null;
  }

  // Handler for geolocation (reset to current location)
  function handleUseMyLocation() {
    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMarker({ lat: latitude, lng: longitude });
          onLocationSelectAction({ lat: latitude, lng: longitude });
          setLoading(false);
        },
        () => setLoading(false)
      );
    } else {
      setLoading(false);
    }
  }

  const defaultCenter: [number, number] = marker ? [marker.lat, marker.lng] : [20.5937, 78.9629];

  return (
    <div>
      {loading && (
        <div className="mb-2 text-sm text-muted-foreground">Detecting your location...</div>
      )}
      {!loading && marker && (
        <div className="mb-2 flex gap-2">
          <button type="button" className="px-3 py-1 rounded bg-primary text-white text-xs" onClick={handleUseMyLocation}>
            Use My Current Location
          </button>
        </div>
      )}
      {/* @ts-expect-error: react-leaflet type issue for center prop, works at runtime */}
      <MapContainer
        center={defaultCenter}
        zoom={marker ? 15 : 5}
        style={{ height: '400px', width: '100%' }}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // @ts-ignore
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {marker && <Marker position={[marker.lat, marker.lng]} />}
        <MapClickHandler />
      </MapContainer>
    </div>
  );
}
