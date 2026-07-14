import React, { useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export default function TestComp() {
  const routesLib = useMapsLibrary('routes');
  useEffect(() => {
    if (routesLib) {
      console.log('routesLib keys:', Object.keys(routesLib));
    }
  }, [routesLib]);
  return <div>Test</div>;
}
