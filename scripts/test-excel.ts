import XLSX from 'xlsx';

const workbook = XLSX.readFile('attached_assets/eventos_uplaod_1761247440035.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(sheet);

console.log('Total de linhas:', jsonData.length);
console.log('\n=== Primeira linha (exemplo) ===');
console.log(JSON.stringify(jsonData[0], null, 2));

console.log('\n=== Colunas encontradas ===');
if (jsonData.length > 0) {
  console.log(Object.keys(jsonData[0]));
}

console.log('\n=== Todas as linhas ===');
console.log(JSON.stringify(jsonData, null, 2));
