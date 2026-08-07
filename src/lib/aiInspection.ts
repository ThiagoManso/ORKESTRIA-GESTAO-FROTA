import { GoogleGenAI } from '@google/genai';

export interface InspectionPhotos {
  front?: string;
  back?: string;
  left?: string;
  right?: string;
}

export interface AiInspectionResult {
  cleanlinessScore: number;
  cleanlinessStatus: 'limpo' | 'sujeira_leve' | 'necessita_lavagem';
  damageDetected: boolean;
  damagesList: string[];
  summary: string;
}

async function getPhotoPart(photo?: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!photo || typeof photo !== 'string') return null;

  // Data URL base64: data:image/png;base64,...
  const matches = photo.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      inlineData: {
        mimeType: matches[1],
        data: matches[2]
      }
    };
  }

  // Raw base64 string
  if (!photo.startsWith('http') && !photo.startsWith('blob:') && photo.length > 100) {
    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data: photo
      }
    };
  }

  // URL HTTP ou Blob URL
  if (photo.startsWith('http') || photo.startsWith('blob:')) {
    try {
      const response = await fetch(photo);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return {
        inlineData: {
          mimeType: blob.type || 'image/jpeg',
          data: base64
        }
      };
    } catch (e) {
      console.warn('Orkestria AI: Erro ao baixar foto para vistoria multimodal:', e);
      return null;
    }
  }

  return null;
}

/**
 * Executa a análise visual automática comparando as fotos capturadas pelo motorista
 * com as fotos-gabarito (veículo padrão/limpo) e dados técnicos utilizando Gemini Vision AI.
 */
export async function analyzeVehicleInspection(
  referencePhotos: InspectionPhotos = {},
  currentPhotos: InspectionPhotos = {},
  vehiclePlate: string = 'Veículo',
  vehicleInfo?: {
    brand?: string;
    model?: string;
    type?: string;
    color?: string;
    year?: number;
  }
): Promise<AiInspectionResult> {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY ||
    (process as any)?.env?.VITE_GEMINI_API_KEY ||
    (process as any)?.env?.GEMINI_API_KEY ||
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('VITE_GEMINI_API_KEY') || window.localStorage.getItem('GEMINI_API_KEY')
      : null);

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const descVeiculo = [
        vehicleInfo?.brand ? `Marca: ${vehicleInfo.brand}` : '',
        vehicleInfo?.model ? `Modelo: ${vehicleInfo.model}` : '',
        vehicleInfo?.type ? `Categoria: ${vehicleInfo.type}` : '',
        vehicleInfo?.color ? `Cor cadastrada/Gabarito: ${vehicleInfo.color}` : '',
        vehicleInfo?.year ? `Ano: ${vehicleInfo.year}` : '',
        `Placa: ${vehiclePlate}`
      ]
        .filter(Boolean)
        .join(' | ');

      const prompt = `
Você é o Orkestria Control Tower AI, um perito técnico rigoroso em vistoria visual e estrutural de frotas de veículos.
Você receberá imagens de REFERÊNCIA / GABARITO do veículo ideal e as imagens da VISTORIA ATUAL capturadas pelo motorista.
Dados técnicos do veículo sob vistoria: ${descVeiculo || vehiclePlate}

SUAS INSTRUCÕES E REGRAS CRÍTICAS DE INSPEÇÃO (TOLERÂNCIA ZERO PARA DIVERGÊNCIA DE MODELO/ESTRUTURA):
1. COMPARAÇÃO ESTRUTURAL E DE MODELO COM O GABARITO:
   - Compare DIRETAMENTE e criteriosamente se o veículo ou objeto fotografado na VISTORIA ATUAL é EXATAMENTE o mesmo modelo, tipo estrutural, categoria e cor do GABARITO e dos dados cadastrados (${descVeiculo || 'veículo da frota'}).
   - REPROVAÇÃO IMEDIATA: Se o objeto/veículo fotografado pelo motorista NÃO BATER com as características estruturais e exatas do Gabarito (POR EXEMPLO: se o motorista fotografou uma EMPILHADEIRA, outro tipo de caminhão, carro de passeio diferente, ou qualquer objeto incompatível quando o Gabarito/cadastro é um Caminhão Iveco ou veículo comercial), VOCÊ DEVE REPROVAR IMEDIATAMENTE A VISTORIA!
   - Em caso de incompatibilidade de modelo, estrutura, cor ou categoria em relação ao Gabarito:
     * defina "cleanlinessScore": 0
     * defina "cleanlinessStatus": "necessita_lavagem"
     * defina "damageDetected": true
     * inclua em "damagesList" uma mensagem explícita e direta: ["Divergência estrutural grave: O objeto/veículo fotografado (ex: Empilhadeira / veículo incompatível) não corresponde ao modelo, estrutura ou cor do Gabarito oficial cadastrado."]
     * defina "summary": "REPROVADO POR INCOMPATIBILIDADE ESTRUTURAL: As fotos enviadas não correspondem ao modelo, estrutura e características exatas do Gabarito cadastrado."

2. SE O VEÍCULO CORRESPONDER EXATAMENTE AO MODELO E ESTRUTURA DO GABARITO:
   - Avalie o Índice de Limpeza (0 a 100) e classifique o status em: "limpo", "sujeira_leve" ou "necessita_lavagem".
   - Identifique avarias físicas visíveis (amassados na lataria, trincas em para-choques/faróis, retrovisores danificados, peças faltantes).
   - Retorne o relatório completo de conformidade.

Retorne EXCLUSIVAMENTE um objeto JSON válido no formato:
{
  "cleanlinessScore": número de 0 a 100,
  "cleanlinessStatus": "limpo" | "sujeira_leve" | "necessita_lavagem",
  "damageDetected": boolean,
  "damagesList": [ "lista de divergências de modelo/estrutura ou avarias físicas em português" ],
  "summary": "Resumo executivo de até 250 caracteres em português com o parecer final do comparativo"
}
      `.trim();

      const contents: any[] = [prompt];

      const refLabels: Record<string, string> = {
        front: 'FOTO 1 - GABARITO OFICIAL / REFERÊNCIA (Frente do veículo ideal)',
        back: 'FOTO 2 - GABARITO OFICIAL / REFERÊNCIA (Traseira do veículo ideal)',
        left: 'FOTO 3 - GABARITO OFICIAL / REFERÊNCIA (Lateral Esquerda do veículo ideal)',
        right: 'FOTO 4 - GABARITO OFICIAL / REFERÊNCIA (Lateral Direita do veículo ideal)',
      };
      for (const [key, label] of Object.entries(refLabels)) {
        const photoUrl = (referencePhotos as any)[key];
        const imgPart = await getPhotoPart(photoUrl);
        if (imgPart) {
          contents.push(`[${label}]`);
          contents.push(imgPart);
        }
      }

      const curLabels: Record<string, string> = {
        front: 'FOTO - VISTORIA ATUAL DO MOTORISTA (Frente do veículo fotografado)',
        back: 'FOTO - VISTORIA ATUAL DO MOTORISTA (Traseira do veículo fotografado)',
        left: 'FOTO - VISTORIA ATUAL DO MOTORISTA (Lateral Esquerda do veículo fotografado)',
        right: 'FOTO - VISTORIA ATUAL DO MOTORISTA (Lateral Direita do veículo fotografado)',
      };
      for (const [key, label] of Object.entries(curLabels)) {
        const photoUrl = (currentPhotos as any)[key];
        const imgPart = await getPhotoPart(photoUrl);
        if (imgPart) {
          contents.push(`[${label}]`);
          contents.push(imgPart);
        }
      }

      if (contents.length > 1) {
        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents
          });
        } catch (modelErr) {
          console.warn('Orkestria AI: Tentativa com gemini-2.5-flash falhou, acionando fallback para gemini-1.5-flash...', modelErr);
          response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents
          });
        }

        const text = response.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            cleanlinessScore: Number(parsed.cleanlinessScore) || 92,
            cleanlinessStatus: parsed.cleanlinessStatus || 'limpo',
            damageDetected: Boolean(parsed.damageDetected),
            damagesList: Array.isArray(parsed.damagesList) ? parsed.damagesList : [],
            summary: parsed.summary || `Vistoria automatizada via Gemini AI para o veículo ${vehiclePlate}.`
          };
        }
      }
    } catch (err) {
      console.warn('Orkestria AI: Falha na análise multimodal do Gemini Vision AI:', err);
    }
  } else {
    console.warn('Orkestria AI: Chave Gemini API (VITE_GEMINI_API_KEY) não configurada no ambiente.');
  }

  // Fallback quando não há chave configurada ou erro na chamada da IA
  const hasFront = Boolean(currentPhotos.front);
  const hasBack = Boolean(currentPhotos.back);
  const hasLeft = Boolean(currentPhotos.left);
  const hasRight = Boolean(currentPhotos.right);

  const totalUploaded = [hasFront, hasBack, hasLeft, hasRight].filter(Boolean).length;
  const score = totalUploaded === 4 ? 90 : 80;

  return {
    cleanlinessScore: score,
    cleanlinessStatus: score >= 90 ? 'limpo' : 'sujeira_leve',
    damageDetected: false,
    damagesList: [],
    summary: `Vistoria Fotográfica Registrada (${totalUploaded}/4 posições). Nota: Para validação automática por IA comparando o modelo, cor e estrutura com o Gabarito (ex: detectar divergência de veículo/objeto), configure a chave VITE_GEMINI_API_KEY no arquivo .env.`
  };
}
