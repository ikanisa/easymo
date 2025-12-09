"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { BulkImportResult } from "@/types/member";

interface ImportWizardProps {
  saccoId: string;
  groups: Array<{ id: string; name: string; code: string }>;
}

export default function ImportWizard({ saccoId, groups }: ImportWizardProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj: any = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || "";
      });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      // Map CSV to member objects
      const members = rows
        .filter((row) => row.full_name && row.phone)
        .map((row) => ({
          full_name: row.full_name || row.name,
          phone: row.phone || row.mobile || row.msisdn,
          ikimina_id: row.group_id || row.ikimina_id,
          national_id: row.national_id || row.nid,
          email: row.email,
          gender: row.gender?.toLowerCase(),
          date_of_birth: row.date_of_birth || row.dob,
        }));

      if (members.length === 0) {
        throw new Error("No valid members found in CSV");
      }

      const response = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sacco_id: saccoId, members }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await response.json();
      setResult(data);

      if (data.error_count === 0) {
        setTimeout(() => {
          router.push("/members");
          router.refresh();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = `full_name,phone,email,national_id,gender,date_of_birth,group_id
John Doe,0781234567,john@example.com,1199012345678901,male,1990-01-15,${groups[0]?.id || ""}
Jane Smith,0782345678,jane@example.com,1198523456789012,female,1985-05-20,${groups[0]?.id || ""}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "member-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Download Template</CardTitle>
          <CardDescription>
            Download the CSV template and fill in your member data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Upload CSV File</CardTitle>
          <CardDescription>
            Select your completed CSV file (max 500 members per import)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={importing}
              />
              <Button variant="outline" className="w-full" asChild>
                <span>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {file ? file.name : "Choose CSV File"}
                </span>
              </Button>
            </label>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="min-w-32"
            >
              {importing ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert variant={result.error_count > 0 ? "default" : "default"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Import Complete</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Successfully imported {result.success_count} of {result.total_count} members
                </p>
                {result.error_count > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold">Errors ({result.error_count}):</p>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                      {result.errors.map((err, i) => (
                        <div key={i} className="text-red-600">
                          Row {err.row}: {err.name} ({err.phone}) - {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              <strong>Required:</strong> full_name, phone
            </li>
            <li>
              <strong>Optional:</strong> email, national_id, gender, date_of_birth, group_id
            </li>
            <li>Phone format: 0781234567 or +250781234567</li>
            <li>National ID: 16 digits</li>
            <li>Gender: male, female, or other</li>
            <li>Date format: YYYY-MM-DD</li>
            <li>Maximum 500 members per import</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
