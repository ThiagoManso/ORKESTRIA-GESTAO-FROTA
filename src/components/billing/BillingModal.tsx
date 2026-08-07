import React from 'react';
import { X, Check, ShieldCheck, Zap, Award, Sparkles, Truck, PhoneCall } from 'lucide-react';
import { SystemUser } from '../../types';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUser | null;
}

export default function BillingModal({ isOpen, onClose, currentUser }: BillingModalProps) {
  if (!isOpen) return null;

  const plans = [
    {
      name: 'Frota Inicial',
      subtitle: 'Para até 10 veículos em operação',
      price: '297',
      features: [
        'Até 10 veículos cadastrados',
        'Checklist diário com IA (até 500 fotos/mês)',
        'Torre de Controle de Entregas & Acareações',
        'Gestão ilimitada de motoristas e CNHs',
        'Roteirização Inteligente com economia de combustível',
        'Suporte dedicado por WhatsApp'
      ],
      popular: false
    },
    {
      name: 'Frota em Crescimento',
      subtitle: 'Para até 35 veículos e múltiplos times',
      price: '697',
      features: [
        'Até 35 veículos cadastrados',
        'Checklist diário com IA (fotos ilimitadas)',
        'Torre de Controle Multi-usuário com permissões por tela',
        'Portal de Demandas de Clientes (coleta e entrega)',
        'Dashboard financeiro de abastecimentos e manutenções',
        'Rastreamento em campo com mapa de operação',
        'Gerente de Contas Orkestria dedicado'
      ],
      popular: true
    },
    {
      name: 'Frota Corporativa',
      subtitle: 'Acima de 50 veículos & Operação Heavy',
      price: '1.497',
      features: [
        'Veículos, motoristas e vistorias ILIMITADOS',
        'IA Avançada para detecção de avarias estruturais',
        'Integração via API com seu ERP / TMS / Telemetria',
        'Acesso prioritário a novas funcionalidades IA',
        'SLA 99.9% de uptime garantido em contrato',
        'Treinamento presencial/remoto da sua equipe de campo'
      ],
      popular: false
    }
  ];

  const handleContactSales = (planName: string) => {
    const companyText = currentUser?.companyName 
      ? `da empresa *${currentUser.companyName}*` 
      : '';
    const msg = `Olá, equipe Orkestria OS! Concluímos o trial de 7 dias ${companyText} e desejamos ativar a assinatura do plano *${planName}*.`;
    const url = `https://wa.me/5511999999999?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl relative text-white animate-in fade-in zoom-in-95 duration-200 my-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors z-10 p-2 rounded-full hover:bg-slate-800"
        >
          <X size={22} />
        </button>

        <div className="p-8 sm:p-10 text-center border-b border-slate-800 bg-gradient-to-b from-purple-950/40 to-slate-900">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs font-bold uppercase tracking-wider mb-3 border border-brand-cyan/20">
            <Sparkles size={14} /> Evolua sua Frota com Inteligência
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Escolha o Plano Ideal para {currentUser?.companyName || 'Sua Empresa'}
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2">
            Todos os planos incluem cópias de segurança na nuvem e o motor de IA veicular nativo da Orkestria.
          </p>
        </div>

        <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col justify-between relative border transition-all ${
                plan.popular
                  ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-brand-cyan shadow-xl shadow-cyan-500/10 md:-translate-y-2'
                  : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-brand-cyan to-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full shadow-md">
                  Mais Escolhido
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{plan.subtitle}</p>

                <div className="mt-6 mb-6">
                  <span className="text-4xl font-extrabold text-white">R$ {plan.price}</span>
                  <span className="text-slate-400 text-sm">/mês</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                        <Check size={12} />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleContactSales(plan.name)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-brand-cyan to-blue-600 text-white hover:opacity-95 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-700/80 hover:bg-slate-700 text-white'
                }`}
              >
                <PhoneCall size={16} />
                <span>Ativar Assinatura {plan.name}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="p-6 bg-slate-950/60 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Garantia de proteção de dados (LGPD compliance)</span>
          </div>
          <span className="hidden sm:inline text-slate-700">•</span>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Truck size={16} className="text-brand-cyan" />
            <span>Migração e setup assistido pela equipe Orkestria</span>
          </div>
        </div>
      </div>
    </div>
  );
}
