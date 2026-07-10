import { useState, useEffect } from 'react';

// Haversine formula to calculate distance in meters between two lat/lng coordinates
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);  
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

export function useGeofencing(targetLat?: number, targetLng?: number, radiusMeters: number = 1000) {
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [isInside, setIsInside] = useState(false);
  
  useEffect(() => {
    if (typeof targetLat !== 'number' || typeof targetLng !== 'number') return;
    if (!navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const dist = getDistanceFromLatLonInMeters(
          position.coords.latitude, 
          position.coords.longitude, 
          targetLat, 
          targetLng
        );
        setCurrentDistance(dist);
        setIsInside(dist <= radiusMeters);
      },
      (error) => {
        console.warn('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [targetLat, targetLng, radiusMeters]);
  
  return { currentDistance, isInside };
}
