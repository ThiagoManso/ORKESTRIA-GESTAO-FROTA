const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const badString = "<Suspense fallback={\\n<div className=\\\"h-full w-full flex items-center justify-center min-h-[400px]\\\">\\n  <div className=\\\"w-8 h-8 rounded-full border-4 border-ork-primary border-t-transparent animate-spin\\\" />\\n</div>\\n}>";
const goodString = '<Suspense fallback={<div className="h-full w-full flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-4 border-ork-primary border-t-transparent animate-spin" /></div>}>';

code = code.split(badString).join(goodString);
fs.writeFileSync('src/App.tsx', code);
