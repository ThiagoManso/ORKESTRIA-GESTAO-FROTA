const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(
  /localCache: persistentLocalCache\(\{ tabManager: persistentMultipleTabManager\(\) \}\)/,
  ""
);
// Remove trailing comma from the experimentalForceLongPolling line if necessary, or just rely on TypeScript's leniency.
// Actually let's just replace the whole try block.

code = code.replace(
  /const initFirestore = \(dbId\?: string\) => \{\n  try \{\n    return initializeFirestore\(app, \{\n      experimentalForceLongPolling: true,\n      \n    \}, dbId\);\n  \} catch \(e\) \{\n    return getFirestore\(app, dbId\);\n  \}\n\};/,
  `const initFirestore = (dbId?: string) => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true
    }, dbId);
  } catch (e) {
    return getFirestore(app, dbId);
  }
};`
);

fs.writeFileSync('src/lib/firebase.ts', code);
