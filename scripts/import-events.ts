import XLSX from 'xlsx';
import { db } from '../server/db';
import { events } from '../shared/schema';

async function importEvents() {
  try {
    console.log('Lendo arquivo Excel...');
    const workbook = XLSX.readFile('attached_assets/eventos_uplaod_1761164140344.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Encontrados ${data.length} eventos no arquivo`);
    console.log('Primeira linha de exemplo:', data[0]);
    
    // Mapeamento de status PT -> EN
    const statusMap: Record<string, string> = {
      'Planejamento': 'planning',
      'Em andamento': 'in_progress',
      'Aprovado': 'approved',
      'Concluído': 'completed',
      'Cancelado': 'cancelled',
    };
    
    // Importar eventos
    let imported = 0;
    for (const row of data as any[]) {
      try {
        // Função para converter data do Excel
        const parseExcelDate = (excelDate: any): Date => {
          if (typeof excelDate === 'number') {
            const parsed = XLSX.SSF.parse_date_code(excelDate);
            return new Date(parsed.y, parsed.m - 1, parsed.d);
          } else if (typeof excelDate === 'string') {
            return new Date(excelDate);
          }
          return new Date();
        };
        
        // Mapear campos do Excel para o schema
        const eventData = {
          name: row['Nome do Evento'] || row.Nome || row.name,
          client: row.Cliente || row.client,
          location: row.Local || row.location,
          setupDate: parseExcelDate(row['Data de Montagem']),
          eventDate: parseExcelDate(row['Data do evento']),
          teardownDate: parseExcelDate(row['Data da desmontagem']),
          status: statusMap[row.Status] || 'planning',
          notes: row.Descrição || row.description || null,
        };
        
        // Validar campos obrigatórios
        if (!eventData.name || !eventData.client || !eventData.location) {
          console.log('Evento ignorado (campos obrigatórios faltando):', eventData);
          continue;
        }
        
        await db.insert(events).values(eventData as any);
        imported++;
        console.log(`✓ Importado: ${eventData.name}`);
      } catch (error) {
        console.error('Erro ao importar evento:', error);
      }
    }
    
    console.log(`\n✓ ${imported} eventos importados com sucesso!`);
  } catch (error) {
    console.error('Erro ao importar eventos:', error);
  }
  process.exit(0);
}

importEvents();
