import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in module:", error, errorInfo);
  }

  public render() {
    const props = (this as any).props as Props;
    const setState = (s: Partial<State>) => (this as any).setState(s);

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white rounded-2xl border border-slate-200 shadow-sm m-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Não foi possível carregar {props.moduleName ? `o módulo ${props.moduleName}` : 'este módulo'}
          </h3>
          <p className="text-sm text-slate-600 max-w-md mb-6">
            Ocorreu um problema temporário ao exibir esta tela. Você pode recarregar o módulo para continuar.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <RefreshCw size={16} />
              Tentar Novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
          {this.state.error && (
            <details className="mt-6 text-left w-full max-w-md bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500">
              <summary className="cursor-pointer font-medium mb-1">Detalhes técnicos do erro</summary>
              <pre className="whitespace-pre-wrap overflow-x-auto font-mono text-[11px]">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return props.children;
  }
}
