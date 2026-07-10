const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagementView.tsx', 'utf8');

code = code.replace(/const activeUsers = filteredUsers.filter\\(u => u.status !== 'inactive'\\);/, `const activeUsers = filteredUsers.filter(u => u.status === 'active');
  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');`);

fs.writeFileSync('src/components/UserManagementView.tsx', code);
