const fs = require('fs');
let code = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));

if (!code.exclude) {
    code.exclude = [];
}
code.exclude.push("functions");

fs.writeFileSync('tsconfig.json', JSON.stringify(code, null, 2));
