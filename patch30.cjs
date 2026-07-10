const fs = require('fs');
let code = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

code = code.replace(/alert\\('Sua conta foi criada com sucesso e está aguardando aprovação do administrador.'\\);/, "alert('Sua conta está aguardando aprovação do administrador. Você receberá acesso assim que for liberada.');");

fs.writeFileSync('src/lib/AuthContext.tsx', code);
