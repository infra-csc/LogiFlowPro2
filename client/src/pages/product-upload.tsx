import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { userIsAdmin } from "@/lib/authz";

type ParsedProduct = {
  sku: string;
  name: string;
  ownership: string;
  unit: string;
  weight?: string;
  currentStock?: number;
  minimumStock?: number;
};

type BulkResult = {
  message: string;
  success: Array<{ row: number; product: any }>;
  errors: Array<{ row: number; data: any; error: string }>;
};

export default function ProductUpload() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = userIsAdmin(user);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedProduct[]>([]);
  const [uploadResult, setUploadResult] = useState<BulkResult | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (products: ParsedProduct[]) => {
      const response = await apiRequest("POST", "/api/products/bulk", { products });
      return response.json();
    },
    onSuccess: (data: BulkResult) => {
      setUploadResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
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
        description: "Não foi possível importar os produtos",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        const products: ParsedProduct[] = jsonData.map((row) => {
          const weight = row.Peso || row.weight;
          return {
            sku: row.SKU || row.sku,
            name: row.Name || row.name,
            ownership: (row.Ownership || row.ownership || "owned").toLowerCase(),
            unit: row.Unit || row.unit || "unit",
            weight: weight !== undefined && weight !== null ? String(weight) : undefined,
            currentStock: row["Estoque Atual"] || row.currentStock || 0,
            minimumStock: row["Estoque Minimo"] || row["Estoque Mínimo"] || row.minimumStock || 0,
          };
        });

        setParsedData(products);
        toast({
          title: "Arquivo processado",
          description: `${products.length} produtos encontrados`,
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Importação de Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Faça upload de uma planilha Excel para importar produtos em lote
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload de Planilha
          </CardTitle>
          <CardDescription>
            A planilha deve conter as colunas: SKU, Name, Ownership, Unit, Peso, Estoque Atual, Estoque Minimo
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
                  disabled={uploadMutation.isPending || parsedData.length === 0 || !canWrite}
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
                <strong>{parsedData.length} produtos</strong> prontos para importação. 
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
                        SKU: {error.data.sku} - {error.error}
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
            <CardTitle className="text-lg">Preview dos Dados ({parsedData.length} produtos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Propriedade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="text-right">Estoque Atual</TableHead>
                    <TableHead className="text-right">Estoque Mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((product, idx) => (
                    <TableRow key={idx} data-testid={`preview-row-${idx}`}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.ownership}</Badge>
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                      <TableCell className="text-right">{product.weight || "-"}</TableCell>
                      <TableCell className="text-right">{product.currentStock || 0}</TableCell>
                      <TableCell className="text-right">{product.minimumStock || 0}</TableCell>
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
