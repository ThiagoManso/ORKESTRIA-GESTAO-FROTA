import React, { useState } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  LayoutDashboard, 
  MapPin, 
  Users, 
  Truck, 
  AlertTriangle, 
  DollarSign, 
  ShieldCheck 
} from 'lucide-react';

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  companyName?: string;
}

interface Step {
  title: string;
  module: string;
  icon: any;
  color: string;
  description: string;
  highlights: string[];
}

const STEPS: Step[] = [
  {
    title: 'Centro de Comando em Tempo Real',
    module: 'Torre de Controle (Dashboard)',
    icon: LayoutDashboard,
    color: 'text-brand-cyan bg-cyan-50 border-cyan-200',
    description:
      'A Torre de Controle é a visão geral da sua operação. Aqui você acompanha em tempo real o status de cada entrega, motoristas ativos, quilometragem percorrida e alertas automáticos.',
    highlights: [
      'Indicadores operacionais atualizados ao vivo',
      'Taxa de sucesso nas entregas diárias',
      'Atalhos rápidos para resolver gargalos da frota'
    ]
  },
  {
    title: 'Roteirização e Otimização com IA',
    module: 'Rotas & Trajetos',
    icon: MapPin,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    description:
      'O módulo de Rotas permite importar e criar listas de entregas/coletas. Nosso algoritmo sequencia automaticamente os pontos de parada para gastar menos tempo e combustível.',
    highlights: [
      'Criação de rotas com múltiplos pontos',
      'Acompanhamento do status de cada parada (pendente, realizada, ocorrência)',
      'Comprovante com assinatura e foto da entrega'
    ]
  },
  {
    title: 'Gestão Completa de Motoristas',
    module: 'Entregadores',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description:
      'Controle seus colaboradores e motoristas terceirizados. Verifique documentação de CNH, CPF, veículo associado, status online/offline e nota de avaliação de performance.',
    highlights: [
      'Aprovação e cadastro ágil de novos entregadores',
      'Link direto para contato via WhatsApp',
      'Histórico de rotas concluídas e avaliação contínua'
    ]
  },
  {
    title: 'Monitoramento da Frota',
    module: 'Veículos',
    icon: Truck,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description:
      'Gerencie toda a sua frota de carros, vans, motos e caminhões. Acompanhe inspeções diárias (checklist visual com IA) para detectar avarias e manter os veículos seguros.',
    highlights: [
      'Controle por placa, marca, modelo e capacidade de carga',
      'Inspeção visual fotográfica analisada por Inteligência Artificial',
      'Alerta de manutenção preventiva e documentação'
    ]
  },
  {
    title: 'Resolução de Ocorrências e Trajetos ao Vivo',
    module: 'Mapa ao Vivo & Acareação',
    icon: AlertTriangle,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description:
      'Acompanhe todos os veículos no mapa interativo com GPS. Quando houver qualquer imprevisto na entrega (endereço não localizado, avaria, destinatário ausente), resolva no módulo de Acareação.',
    highlights: [
      'Mapa por GPS em tempo real de toda a frota',
      'Tratativa rápida de pendências com registro auditável',
      'Redução de reentregas e prejuízos operacionais'
    ]
  },
  {
    title: 'Controle de Custos e Banco de Demandas',
    module: 'Financeiro & Chamados',
    icon: DollarSign,
    color: 'text-slate-700 bg-slate-100 border-slate-300',
    description:
      'Acompanhe custos de frete por rota e gerencie solicitações internas ou externas (de clientes e parceiros) em um banco de demandas integrado.',
    highlights: [
      'Fechamento financeiro de entregas e viagens',
      'Solicitação de coletas externas por link compartilhável',
      'Acesso seguro e gestão centralizada da equipe'
    ]
  }
];

export default function OnboardingTutorial({
  isOpen,
  onClose,
  onComplete,
  companyName
}: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <ShieldCheck size={22} className="text-brand-cyan" />
            </div>
            <div>
              <p className="text-xs font-semibold text-brand-cyan uppercase tracking-wider">
                {companyName ? `Ambiente: ${companyName}` : 'Guia de Primeiro Acesso'}
              </p>
              <h2 className="text-lg font-bold">Tutorial Operacional Orkestria OS</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Fechar Tutorial"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo da Etapa */}
        <div className="p-8 flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl border ${step.color}`}>
              <Icon size={28} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Módulo {currentStep + 1} de {STEPS.length}
              </span>
              <h3 className="text-xl font-bold text-slate-800">{step.module}</h3>
            </div>
          </div>

          <h4 className="text-lg font-semibold text-slate-700 mb-2">{step.title}</h4>
          <p className="text-slate-600 leading-relaxed mb-6">{step.description}</p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              O que você irá enxergar e fazer:
            </p>
            {step.highlights.map((highlight, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-sm font-medium text-slate-700">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé / Navegação */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-6 bg-brand-cyan'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-bold transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
            )}

            {!isLast ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                Próximo
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-cyan-600 text-white text-sm font-bold transition-colors flex items-center gap-2 shadow-md"
              >
                <CheckCircle2 size={18} />
                Concluir Tutorial
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
