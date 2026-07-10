const fs = require('fs');
let code = fs.readFileSync('src/lib/routeManifestService.ts', 'utf8');

code = code.replace(/import \{ handleFirestoreError \} from '\.\/services';/, "import { handleFirestoreError } from './error-handler';");

fs.writeFileSync('src/lib/routeManifestService.ts', code);
