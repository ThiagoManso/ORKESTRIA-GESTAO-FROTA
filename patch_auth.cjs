const fs = require('fs');
let code = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

const target = `            if (p?.status === 'inactive') {`;
const replacement = `            if (p?.status === 'pending') {
              setProfile(null);
              setUser(null);
              signOut(auth);
              alert('Sua conta está aguardando aprovação do administrador. Você receberá acesso assim que for liberada.');
              setLoading(false);
              return;
            }
            if (p?.status === 'inactive') {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/AuthContext.tsx', code);
