import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type ParsedEvent = {
  sku?: string;
  name: string;
  client: string;
  location: string;
  setupDate: Date;
  eventDate: Date;
  teardownDate: Date;
  requestWindowStart?: Date;
  requestWindowEnd?: Date;
  status?: string;
  notes?: string;
};

type BulkResult = {
  message: string;
  success: Array<{ row: number; event: any }>;
  errors: Array<{ row: number; data: any; error: string }>;
};

export default function EventUpload() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEvent[]>([]);
  const [uploadResult, setUploadResult] = useState<BulkResult | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (events: ParsedEvent[]) => {
      const response = await apiRequest("POST", "/api/events/bulk", { events });
      return response.json();
    },
    onSuccess: (data: BulkResult) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      if (data.errors.length === 0) {
        toast({
          title: "Importação concluída",
          description: data.message,
        });
      } else {
        toast({
          title: "Importação parcial",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar os eventos",
        variant: "destructive",
      });
    },
  });

  const parseExcelDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    
    if (value instanceof Date) return value;
    
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value);
      return new Date(date.y, date.m - 1, date.d);
    }
    
    if (typeof value === "string") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    
    return undefined;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        const events: ParsedEvent[] = jsonData.map((row) => {
          const setupDate = parseExcelDate(
            row["Data de Montagem"] || row["Data Montagem"] || row.setupDate || row.SetupDate
          );
          const eventDate = parseExcelDate(
            row["Data do evento"] || row["Data Evento"] || row.eventDate || row.EventDate
          );
          const teardownDate = parseExcelDate(
            row["Data da desmontagem"] || row["Data Desmontagem"] || row.teardownDate || row.TeardownDate
          );
          const requestWindowStart = parseExcelDate(
            row["Janela de Início"] || row["Janela Início"] || row.requestWindowStart || row.RequestWindowStart
          );
          const requestWindowEnd = parseExcelDate(
            row["Janela de Fim"] || row["Janela Fim"] || row.requestWindowEnd || row.RequestWindowEnd
          );

          // Map Portuguese status to English
          let status = row.Status || row.status || "planning";
          const statusMap: Record<string, string> = {
            "Planejamento": "planning",
            "Em andamento": "in_progress",
            "Aprovado": "approved",
            "Concluído": "completed",
            "Cancelado": "cancelled"
          };
          if (statusMap[status]) {
            status = statusMap[status];
          }

          return {
            sku: row.SKU || row.sku,
            name: row["Nome do Evento"] || row.Nome || row.Name || row.name,
            client: row.Cliente || row.Client || row.client,
            location: row.Local || row.Location || row.location,
            setupDate: setupDate!,
            eventDate: eventDate!,
            teardownDate: teardownDate!,
            requestWindowStart,
            requestWindowEnd,
            status,
            notes: row.Observações || row.Notes || row.notes,
          };
        });

        setParsedData(events);
        toast({
          title: "Arquivo processado",
          description: `${events.length} eventos encontrados`,
        });
      } catch (error) {
        toast({
          title: "Erro ao processar arquivo",
          description: "Verifique se o arquivo está no formato correto",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUpload = () => {
    if (parsedData.length === 0) {
      toast({
        title: "Nenhum dado para importar",
        description: "Selecione um arquivo primeiro",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(parsedData);
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setUploadResult(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importação de Eventos"
        description="Faça upload de uma planilha Excel para importar eventos em lote"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload de Planilha
          </CardTitle>
          <CardDescription>
            A planilha deve conter as colunas: Nome do Evento, Cliente, Local, Data de Montagem, Data do evento, Data da desmontagem (opcionais: SKU, Janela de Início, Janela de Fim, Status, Observações)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
              data-testid="input-file-upload"
            />
            {file && (
              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending || parsedData.length === 0}
                  data-testid="button-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadMutation.isPending ? "Importando..." : "Importar"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={uploadMutation.isPending}
                  data-testid="button-reset"
                >
                  Limpar
                </Button>
              </div>
            )}
          </div>

          {parsedData.length > 0 && !uploadResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{parsedData.length} eventos</strong> prontos para importação. 
                Revise os dados abaixo e clique em "Importar" para prosseguir.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm">
                  <strong>{uploadResult.success.length}</strong> importados
                </span>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm">
                    <strong>{uploadResult.errors.length}</strong> erros
                  </span>
                </div>
              )}
            </div>

            {uploadResult.errors.length > 0 && (
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                <h4 className="font-medium text-sm mb-2">Erros encontrados:</h4>
                <div className="space-y-2">
                  {uploadResult.errors.map((error, idx) => (
                    <div key={idx} className="text-sm" data-testid={`error-${idx}`}>
                      <Badge variant="destructive" className="mr-2">Linha {error.row}</Badge>
                      <span className="text-muted-foreground">
                        {error.data.name} - {error.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview dos Dados ({parsedData.length} eventos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Data Montagem</TableHead>
                    <TableHead>Data Evento</TableHead>
                    <TableHead>Data Desmontagem</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((event, idx) => (
                    <TableRow key={idx} data-testid={`preview-row-${idx}`}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{event.sku || "-"}</TableCell>
                      <TableCell>{event.name}</TableCell>
                      <TableCell>{event.client}</TableCell>
                      <TableCell>{event.location}</TableCell>
                      <TableCell className="text-sm">
                        {event.setupDate ? format(event.setupDate, "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.eventDate ? format(event.eventDate, "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.teardownDate ? format(event.teardownDate, "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.status || "planning"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
