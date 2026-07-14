import fs from 'fs';
let code = fs.readFileSync('src/pages/DriverViewPage.tsx', 'utf8');

// Add new state variables
const stateRegex = /const \[notificationStatus, setNotificationStatus\] = useState<string>\('default'\);/m;
const stateReplacement = `const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [notifiedRoutes, setNotifiedRoutes] = useState<string[]>([]);
  const [incomingRoute, setIncomingRoute] = useState<RouteItem | null>(null);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };`;
code = code.replace(stateRegex, stateReplacement);

// Add useEffect for pendingRoutes
const handleAcceptRegex = /const handleAcceptRoute = async/m;
const handleAcceptReplacement = `useEffect(() => {
    if (pendingRoutes.length > 0) {
      const newRoutes = pendingRoutes.filter(r => !notifiedRoutes.includes(r.id));
      if (newRoutes.length > 0) {
        playNotificationSound();
        setIncomingRoute(newRoutes[0]);
        setNotifiedRoutes(prev => [...prev, ...newRoutes.map(r => r.id)]);
      }
    }
  }, [pendingRoutes, notifiedRoutes]);

  const handleAcceptRoute = async`;
code = code.replace(handleAcceptRegex, handleAcceptReplacement);

// Add modal popup to the end of the component returns.
// The component has two returns, one for activeRoute and one for the main view.
// Let's create a shared modal component and inject it just before the final </div> of both.

const modalCode = `
      {incomingRoute && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-brand-cyan p-6 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BellRing size={32} className="animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Nova Rota!</h2>
              <p className="text-brand-cyan/20 text-white/80 font-medium">Você tem uma nova solicitação</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Identificação</span>
                <span className="font-bold text-slate-800">#{formatRouteId(incomingRoute)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Paradas</span>
                <span className="font-bold text-slate-800">{incomingRoute.stops}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-500 font-medium">Distância</span>
                <span className="font-bold text-slate-800">{incomingRoute.distance} km</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => {
                  handleAcceptRoute(incomingRoute.id);
                  setIncomingRoute(null);
                }}
                className="flex-1 py-3.5 bg-gradient-to-r from-brand-cyan to-brand-blue text-white rounded-xl font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-md shadow-brand-blue/20"
              >
                <CheckCircle size={18} /> Aceitar
              </button>
              <button 
                onClick={() => {
                  handleRejectRoute(incomingRoute.id);
                  setIncomingRoute(null);
                }}
                className="px-5 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold active:scale-[0.98] transition-transform hover:bg-slate-50 flex items-center justify-center"
              >
                <XCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
`;

// Inject into activeRoute return
const activeRouteRegex = /<\/div>\n      <\/div>\n    \);\n  \}/m;
code = code.replace(activeRouteRegex, modalCode + '</div>\n      </div>\n    );\n  }');

// Inject into main return
const mainReturnRegex = /<\/div>\n    <\/div>\n  \);\n\}/m;
code = code.replace(mainReturnRegex, modalCode + '</div>\n    </div>\n  );\n}');

fs.writeFileSync('src/pages/DriverViewPage.tsx', code);
