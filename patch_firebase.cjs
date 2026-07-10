const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

const target = "export let db = initFirestore(databaseId && databaseId !== '(default)' ? databaseId : undefined);";
const replacement = `
let safeDbId = databaseId;
if (safeDbId && (safeDbId.includes('/') || safeDbId.includes('.com') || safeDbId === '(default)')) {
  safeDbId = undefined;
}
export let db = initFirestore(safeDbId);
`;

code = code.replace(target, replacement);

fs.writeFileSync('src/lib/firebase.ts', code);
