import React, { useEffect, useRef, useState } from 'react';

interface StoreDirectionsMapProps {
  storeName: string;
  storeLat: number;
  storeLng: number;
}

export const StoreDirectionsMap: React.FC<StoreDirectionsMapProps> = ({ storeName, storeLat, storeLng }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let map: google.maps.Map | null = null;
    let directionsService: google.maps.DirectionsService | null = null;
    let directionsRenderer: google.maps.DirectionsRenderer | null = null;
    let userMarker: google.maps.Marker | null = null;
    let storeMarker: google.maps.Marker | null = null;

    async function initMap() {
      if (!window.google || !window.google.maps) {
        setError('Google Maps failed to load.');
        setLoading(false);
        return;
      }
      setLoading(true);
      // Get user location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          map = new window.google.maps.Map(mapRef.current!, {
            center: userLocation,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          directionsService = new window.google.maps.DirectionsService();
          directionsRenderer = new window.google.maps.DirectionsRenderer({
            map,
            panel: panelRef.current!,
            suppressMarkers: true,
          });
          // Request directions
          directionsService.route(
            {
              origin: userLocation,
              destination: { lat: storeLat, lng: storeLng },
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === 'OK' && result) {
                directionsRenderer!.setDirections(result);
                // User marker
                userMarker = new window.google.maps.Marker({
                  position: userLocation,
                  map,
                  label: 'You',
                  icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                  },
                });
                // Store marker (fixed, not draggable)
                storeMarker = new window.google.maps.Marker({
                  position: { lat: storeLat, lng: storeLng },
                  map,
                  label: storeName,
                  icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  },
                  draggable: false,
                  title: storeName,
                });
              } else {
                setError('Could not find directions.');
              }
              setLoading(false);
            }
          );
        },
        (err) => {
          setError('Could not get your location.');
          setLoading(false);
        }
      );
    }
    initMap();
    return () => {
      // Clean up
      if (userMarker) userMarker.setMap(null);
      if (storeMarker) storeMarker.setMap(null);
      if (directionsRenderer) directionsRenderer.setMap(null);
    };
  }, [storeLat, storeLng, storeName]);

  return (
    <div className="w-full flex flex-col md:flex-row gap-4">
      <div ref={mapRef} className="w-full md:w-2/3 h-80 rounded-lg shadow border" />
      <div ref={panelRef} className="w-full md:w-1/3 h-80 overflow-y-auto bg-white rounded-lg shadow border p-2 text-sm" />
      {loading && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">Loading directions...</div>}
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </div>
  );
};

export default StoreDirectionsMap;
