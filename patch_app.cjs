const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  if (!user) {
    return <LoginView />;
  }`;

const replacement = `  if (!user) {
    return <LoginView />;
  }

  if (user && !profile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-ork-bg text-white">
        <div className="w-12 h-12 rounded-full border-4 border-ork-primary border-t-transparent animate-spin mb-4" />
        <p className="text-ork-text-muted font-bold tracking-widest uppercase text-xs">Preparando seu acesso...</p>
      </div>
    );
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
