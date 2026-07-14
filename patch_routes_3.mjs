import fs from 'fs';
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

const regexData = /const calculateRouteData = async \(routeData: any\) => \{[\s\S]*?    return null;\n  \};/m;

const replacementData = `const calculateRouteData = async (routeData: any) => {
    if (!routesLib || !routeData.origin || !routeData.destination) return { error: 'Preencha a origem e destino.' };
    try {
      const directionsService = new routesLib.DirectionsService();
      const waypoints = (routeData.intermediates || [])
        .filter((addr: string) => addr.trim() !== '')
        .map((addr: string) => ({ location: addr, stopover: true }));

      const request: any = {
        origin: routeData.origin,
        destination: routeData.destination,
        travelMode: 'DRIVING',
        waypoints: waypoints,
        optimizeWaypoints: routeData.optimizeOrder ?? true,
      };

      if (routeData.departureTime) {
        const depDate = new Date(routeData.departureTime);
        request.drivingOptions = {
          departureTime: depDate < new Date() ? new Date(Date.now() + 60000) : depDate,
          trafficModel: 'bestguess'
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
    } catch (error: any) {
      console.error('Error calculating route:', error);
      return { error: error?.message || error?.code || 'Erro desconhecido ao calcular a rota com a API do Google Maps.' };
    }
    return { error: 'Nenhuma rota encontrada.' };
  };`;

code = code.replace(regexData, replacementData);

const regexCalc = /const calculateRoute = async \(\) => \{[\s\S]*?setIsCalculating\(false\);\n  \};/m;
const replacementCalc = `const calculateRoute = async () => {
    setIsCalculating(true);
    const data = await calculateRouteData(newRoute);
    if (data && !data.error) {
      setNewRoute(prev => ({
        ...prev,
        ...data
      }));
    } else {
      alert('Não foi possível calcular a rota com os endereços fornecidos. Erro: ' + (data?.error || ''));
    }
    setIsCalculating(false);
  };`;

code = code.replace(regexCalc, replacementCalc);

const regexAddRoute = /if \(routesLib && newRoute\.origin && newRoute\.destination\) \{\n      const data = await calculateRouteData\(newRoute\);\n      if \(data\) \{\n        finalDistance = data\.distance;\n        finalEstimatedTime = data\.estimatedTime;\n        finalIntermediates = data\.intermediates;\n      \}\n    \}/m;

const replacementAddRoute = `if (routesLib && newRoute.origin && newRoute.destination) {
      const data = await calculateRouteData(newRoute);
      if (data && !data.error) {
        finalDistance = data.distance;
        finalEstimatedTime = data.estimatedTime;
        finalIntermediates = data.intermediates;
      } else {
        alert('Não foi possível calcular a rota com os endereços fornecidos. Erro: ' + (data?.error || ''));
        setIsCalculating(false);
        return; // Prevent saving the route if calculation fails
      }
    }`;

code = code.replace(regexAddRoute, replacementAddRoute);

fs.writeFileSync('src/pages/RoutesPage.tsx', code);
