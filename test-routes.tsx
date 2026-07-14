import React, { useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export function Test() {
  const routesLib = useMapsLibrary('routes');
  useEffect(() => {
    if (routesLib) {
      console.log(routesLib.DirectionsService);
    }
  }, [routesLib]);
  return null;
}
