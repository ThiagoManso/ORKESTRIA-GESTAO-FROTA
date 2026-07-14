import fs from 'fs';
let code = fs.readFileSync('src/pages/RoutesPage.tsx', 'utf8');

const regexAddRoute = /if \(routesLib && newRoute\.origin && newRoute\.destination\) \{\n      const data = await calculateRouteData\(newRoute\);\n      if \(data && !data\.error\) \{\n        finalDistance = data\.distance;\n        finalEstimatedTime = data\.estimatedTime;\n        finalIntermediates = data\.intermediates;\n      \} else \{\n        alert\('Não foi possível calcular a rota com os endereços fornecidos\. Erro: ' \+ \(data\?\.error \|\| ''\)\);\n        setIsCalculating\(false\);\n        return; \/\/ Prevent saving the route if calculation fails\n      \}\n    \}/m;

const replacementAddRoute = `if (newRoute.distance > 0) {
      // Já foi calculado antes pelo botão de calcular, vamos economizar API!
      finalDistance = newRoute.distance;
      finalEstimatedTime = newRoute.estimatedTime || '00:00 h';
      finalIntermediates = newRoute.intermediates;
    } else if (routesLib && newRoute.origin && newRoute.destination) {
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
