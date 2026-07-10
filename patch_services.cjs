const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

code = code.replace(/      const \{ limit \} = await import\('firebase\/firestore'\);\n      \/\/ If no invite and not specifically overridden, check if it's the very first user\n      if \(\!invitedRole && initialRole === 'driver'\) \{\n        try \{\n          const allUsersSnap = await getDocs\(query\(collection\(db, 'users'\), limit\(1\)\)\);\n          if \(allUsersSnap\.empty\) \{\n            initialRole = 'admin';\n          \}\n        \} catch \(e\) \{\n          console\.warn\("Could not check if first user:", e\);\n        \}\n      \}/g, '');

fs.writeFileSync('src/lib/services.ts', code);
