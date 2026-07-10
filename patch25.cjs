const fs = require('fs');
let code = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

code = code.replace(/if \\(p\\?\\.status === 'inactive'\\) \\{/, `if (p?.status === 'pending') {
              setProfile(null);
              setUser(null);
              signOut(auth);
              alert('Sua conta foi criada com sucesso e está aguardando aprovação do administrador.');
              setLoading(false);
              return;
            }
            if (p?.status === 'inactive') {`);

fs.writeFileSync('src/lib/AuthContext.tsx', code);
