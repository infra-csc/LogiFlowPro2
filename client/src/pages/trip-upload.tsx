import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/use-auth";
import { userCanWriteLogistics } from "@/lib/authz";
import { format } from "date-fns";

type ParsedTrip = {
  description: string;
  eventName: string;
  vehicleTypeName: string;
  loadingLocation?: string;
  loadingStartTime?: Date;
  loadingEndTime?: Date;
  departureDateTime?: Date;
  unloadingLocation?: string;
  unloadingStartTime?: Date;
  unloadingEndTime?: Date;
  status?: string;
  notes?: string;
};

type BulkResult = {
  message: string;
  success: Array<{ row: number; trip: any }>;
  errors: Array<{ row: number; data: any; error: string }>;
};

export default function TripUpload() {
  const { user } = useAuth();
  const canWrite = userCanWriteLogistics(user);

  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTrip[]>([]);
  const [uploadResult, setUploadResult] = useState<BulkResult | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (trips: ParsedTrip[]) => {
      const response = await apiRequest("POST", "/api/trips/bulk", { trips });
      return response.json();
    },
    onSuccess: (data: BulkResult) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
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
        description: "Não foi possível importar as viagens",
        variant: "destructive",
      });
    },
  });

  const parseExcelDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    
    if (value instanceof Date) return value;
    
    if (typeof value === 'number') {
      const utc_days = Math.floor(value - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      
      const fractional_day = value - Math.floor(value) + 0.0000001;
      let total_seconds = Math.floor(86400 * fractional_day);
      const seconds = total_seconds % 60;
      total_seconds -= seconds;
      const hours = Math.floor(total_seconds / (60 * 60));
      const minutes = Math.floor(total_seconds / 60) % 60;
      
      return new Date(
        date_info.getUTCFullYear(),
        date_info.getUTCMonth(),
        date_info.getUTCDate(),
        hours,
        minutes,
        seconds
      );
    }
    
    if (typeof value === 'string') {
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
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsed: ParsedTrip[] = jsonData.map((row: any) => {
          return {
            description: String(row['Nome'] || ''),
            vehicleTypeName: String(row['Tipo de Veiculo'] || ''),
            eventName: String(row['Evento ']?.trim() || row['Evento']?.trim() || ''),
            loadingLocation: row['Local de Carregamento'] ? String(row['Local de Carregamento']) : undefined,
            loadingStartTime: parseExcelDate(row['Inicio do carregamento']),
            loadingEndTime: parseExcelDate(row['Final do carregamento']),
            departureDateTime: parseExcelDate(row['Data/Hora de Saída']),
            unloadingLocation: row['Destino/Endereço'] || row['Local de descarregamento'] 
              ? String(row['Local de descarregamento'] || row['Destino/Endereço'])
              : undefined,
            unloadingStartTime: parseExcelDate(row['Inicio do descarregamento']),
            unloadingEndTime: parseExcelDate(row['Final do descarregamento']),
            status: row['status ']?.trim() || row['status']?.trim() || undefined,
            notes: row['Observações'] ? String(row['Observações']) : undefined,
          };
        });

        setParsedData(parsed);
        toast({
          title: "Arquivo carregado",
          description: `${parsed.length} viagens encontradas`,
        });
      } catch (error) {
        toast({
          title: "Erro ao processar arquivo",
          description: "Verifique se o arquivo está no formato correto",
          variant: "destructive",
        });
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = () => {
    if (parsedData.length === 0) {
      toast({
        title: "Nenhum dado para importar",
        description: "Carregue um arquivo primeiro",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(parsedData);
  };

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return "-";
    try {
      return format(date, "dd/MM/yyyy HH:mm");
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importação de Viagens"
        description="Faça upload de uma planilha Excel com as viagens para importação em lote"
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="font-semibold text-base">Upload de Arquivo</div>
          <CardDescription>
            Selecione um arquivo Excel (.xlsx) com as colunas: Nome, Tipo de Veiculo, Evento,
            Local de Carregamento, Inicio do carregamento, Final do carregamento, Data/Hora de Saída,
            Destino/Endereço, Local de descarregamento, Inicio do descarregamento,
            Final do descarregamento, status, Observações
          </CardDescription>
          <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              data-testid="input-file"
            />
            <Button
              onClick={handleUpload}
              disabled={parsedData.length === 0 || uploadMutation.isPending || !canWrite}
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                "Importando..."
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </>
              )}
            </Button>
          </div>

          {file && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                Arquivo selecionado: {file.name} ({parsedData.length} viagens)
              </AlertDescription>
            </Alert>
          )}
          </div>
        </CardContent>
      </Card>

      {uploadResult && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="font-semibold text-base">Resultado da Importação</div>
            <div className="flex gap-4">
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {uploadResult.success.length} Sucesso
              </Badge>
              {uploadResult.errors.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {uploadResult.errors.length} Erros
                </Badge>
              )}
            </div>

            {uploadResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Erros encontrados:</h4>
                {uploadResult.errors.map((error, idx) => (
                  <Alert key={idx} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">Linha {error.row}</div>
                      <div className="text-sm mt-1">{error.error}</div>
                      <div className="text-xs mt-1 text-muted-foreground">
                        Dados: {JSON.stringify(error.data)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {parsedData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="font-semibold text-base">Preview dos Dados</div>
            <CardDescription className="mt-1">
              Revise os dados antes de importar
            </CardDescription>
            <div className="mt-4">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo de Veículo</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Local Carregamento</TableHead>
                    <TableHead>Início Carregamento</TableHead>
                    <TableHead>Local Descarregamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((trip, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{trip.description}</TableCell>
                      <TableCell>{trip.vehicleTypeName}</TableCell>
                      <TableCell>{trip.eventName}</TableCell>
                      <TableCell>{trip.loadingLocation || "-"}</TableCell>
                      <TableCell>{formatDateTime(trip.loadingStartTime)}</TableCell>
                      <TableCell>{trip.unloadingLocation || "-"}</TableCell>
                      <TableCell>{trip.status || "Planejada"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
