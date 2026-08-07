const fs = require('fs');
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

const regex = /const calculateRouteData = async \(routeData: any\) => \{[\s\S]*?    return null;\n  \};/m;

const replacement = `const calculateRouteData = async (routeData: any) => {
    if (!routesLib || !routeData.origin || !routeData.destination) return null;
    try {
      const directionsService = new routesLib.DirectionsService();
      const waypoints = (routeData.intermediates || [])
        .filter((addr: string) => addr.trim() !== '')
        .map((addr: string) => ({ location: addr, stopover: true }));

      const request: any = {
        origin: routeData.origin,
        destination: routeData.destination,
        travelMode: google.maps.TravelMode.DRIVING,
        waypoints: waypoints,
        optimizeWaypoints: routeData.optimizeOrder ?? true,
      };

      if (routeData.departureTime) {
        const depDate = new Date(routeData.departureTime);
        request.drivingOptions = {
          departureTime: depDate < new Date() ? new Date(Date.now() + 60000) : depDate,
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        };
      }

      const response = await directionsService.route(request);
      const route = response.routes?.[0];
      
      if (route) {
        let totalDistance = 0;
        let totalDuration = 0;
        
        route.legs.forEach((leg: any) => {
          totalDistance += leg.distance?.value || 0;
          totalDuration += leg.duration?.value || 0;
        });

        const distanceKm = totalDistance / 1000;
        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);
        const formattedTime = \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')} h\`;
        
        let newIntermediates = routeData.intermediates || [];
        if (route.waypoint_order && route.waypoint_order.length > 0) {
          const original = newIntermediates.filter((addr: string) => addr.trim() !== '');
          newIntermediates = route.waypoint_order.map((idx: number) => original[idx]);
        }

        return {
          intermediates: newIntermediates,
          distance: Number(distanceKm.toFixed(1)),
          estimatedTime: formattedTime
        };
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
    return null;
  };`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/pages/RoutesPage.tsx', code);
