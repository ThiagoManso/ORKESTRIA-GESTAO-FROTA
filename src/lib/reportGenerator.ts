import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CollectionRequest, VehicleLog, Driver } from '../types';
import { formatDate } from './utils';

export const generateDailyPDF = (
  date: string,
  requests: CollectionRequest[],
  logs: VehicleLog[],
  driversList: Driver[],
  userName: string
) => {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [123, 92, 255]; // #7B5CFF
  const secondaryColor: [number, number, number] = [255, 107, 107]; // #FF6B6B
  const textColor: [number, number, number] = [44, 62, 80];

  // --- HEADER ---
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('ORKESTRIA', 20, 25);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(20);
  doc.text('OS', 75, 25);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('SISTEMA DE GESTÃO LOGÍSTICA', 190, 18, { align: 'right' });
  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(`RELATÓRIO DE OPERAÇÕES: ${date}`, 190, 26, { align: 'right' });

  // --- SUMMARY GRID ---
  const completed = requests.filter(r => r.status === 'completed' || r.status === 'delivered_manual').length;
  const total = requests.length;
  const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(20, 50, 50, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('EFICIÊNCIA', 25, 60);
  doc.setFontSize(18);
  doc.text(`${efficiency}%`, 25, 72);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(80, 50, 50, 30, 3, 3, 'F');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(8);
  doc.text('TOTAL PEDIDOS', 85, 60);
  doc.setFontSize(18);
  doc.text(`${total}`, 85, 72);

  doc.setFillColor(240, 253, 244);
  doc.roundedRect(140, 50, 50, 30, 3, 3, 'F');
  doc.setTextColor(22, 163, 74);
  doc.setFontSize(8);
  doc.text('CONCLUÍDOS', 145, 60);
  doc.setFontSize(18);
  doc.text(`${completed}`, 145, 72);

  // --- FLEET STATUS ---
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VISÃO GERAL DA FROTA', 20, 95);
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 97, 190, 97);

  const activeDriversCount = logs.filter(l => l.status === 'active').length;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Veículos em operação hoje: ${activeDriversCount}`, 20, 105);
  doc.text(`Operador responsável pela extração: ${userName}`, 20, 111);

  // --- DATA TABLE ---
  doc.setFont('helvetica', 'bold');
  doc.text('LISTAGEM DETALHADA DE SERVIÇOS', 20, 125);

  const tableData = requests.map(r => {
    const driver = driversList.find(d => d.id === r.assignedDriverId);
    const logDriver = logs.find(l => (l.ownerId === r.assignedDriverId || `legacy-${l.driverName}` === r.assignedDriverId));
    
    return [
      r.title || 'Sem título',
      r.address,
      r.status === 'completed' || r.status === 'delivered_manual' ? 'CONCLUÍDO' : 
      r.status === 'refused' ? 'RECUSADO' : 'PENDENTE',
      driver?.name || logDriver?.driverName || 'N/A',
      formatDate(r.createdAt)
    ];
  });

  autoTable(doc, {
    startY: 130,
    head: [['Pedido', 'Endereço', 'Status', 'Motorista', 'Criação']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [51, 65, 85],
      cellPadding: 4
    },
    columnStyles: {
      2: { fontStyle: 'bold', halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === 'body') {
        const val = String(data.cell.raw);
        if (val === 'CONCLUÍDO') data.cell.styles.textColor = [22, 163, 74];
        else if (val === 'RECUSADO') data.cell.styles.textColor = [220, 38, 38];
        else data.cell.styles.textColor = [202, 138, 4];
      }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 20, right: 20 }
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Página ${i} de ${pageCount} | Gerado em ${new Date().toLocaleString()} | Orkestria OS Intelligence`,
      105,
      285,
      { align: 'center' }
    );
  }

  doc.save(`orkestria-report-${date}.pdf`);
};
