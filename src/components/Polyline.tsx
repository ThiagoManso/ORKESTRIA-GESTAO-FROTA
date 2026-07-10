import { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

export function Polyline({ encodedPath, strokeColor = '#00D1B2' }: { encodedPath: string; strokeColor?: string }) {
  const map = useMap();
  const geometryLib = useMapsLibrary('geometry');
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !geometryLib || !encodedPath) return;

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 5,
      });
    }

    const path = geometryLib.encoding.decodePath(encodedPath);
    polylineRef.current.setPath(path);
    polylineRef.current.setMap(map);

    // Fit bounds to polyline
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds);

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [map, geometryLib, encodedPath, strokeColor]);

  return null;
}
