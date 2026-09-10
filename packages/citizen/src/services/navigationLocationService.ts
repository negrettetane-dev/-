export interface NavigationLocationUpdate {
  lng: number;
  lat: number;
  accuracy: number;
  timestamp: number;
}

export function watchNavigationLocation(
  onUpdate: (location: NavigationLocationUpdate) => void,
  onError?: (error: GeolocationPositionError) => void,
): () => void {
  if (!navigator.geolocation) {
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    position => onUpdate({
      lng: position.coords.longitude,
      lat: position.coords.latitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    }),
    error => onError?.(error),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

export function distanceBetweenMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const radius = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
