
import React, { useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Dataset, DataVariable, VariableType } from '../types';
import { calculateSummaryStats } from '../utils/statistics';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onDataLoaded: (dataset: Dataset) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (event) => {
      if (isExcel) {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processRawData(jsonData, file.name);
      } else {
        const text = event.target?.result as string;
        parseCSV(text, file.name);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const parseCSV = (text: string, filename: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => {
        const val = values[i];
        if (val === '' || val === undefined) obj[h] = null;
        else if (!isNaN(Number(val)) && val.trim() !== '') obj[h] = Number(val);
        else obj[h] = val;
      });
      return obj;
    });

    processRawData(rows, filename);
  };

  const processRawData = (rows: any[], filename: string) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);

    const variables: DataVariable[] = headers.map(h => {
      const rawValues = rows.map(r => r[h]);
      const nonNull = rawValues.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      
      let type: VariableType = 'categorical';
      let processedValues = rawValues;

      if (nonNull.length > 0) {
        // More lenient detection: if > 50% of non-nulls are numeric, treat as numerical
        const numericCount = nonNull.filter(v => !isNaN(Number(v)) && typeof v !== 'boolean').length;
        const isNumericMajority = (numericCount / nonNull.length) > 0.5;

        if (isNumericMajority) {
          type = 'numerical';
          processedValues = rawValues.map(v => {
            if (v === null || v === undefined || String(v).trim() === '') return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
          });
        }
      }

      return {
        name: h,
        type,
        values: processedValues,
        stats: calculateSummaryStats(processedValues, type)
      };
    });

    // Update the row-based data to match processed variable values (casting)
    const processedRows = rows.map((row, idx) => {
      const newRow = { ...row };
      variables.forEach(v => {
        newRow[v.name] = v.values[idx];
      });
      return newRow;
    });

    onDataLoaded({
      filename,
      data: processedRows,
      variables,
      numericalVariables: variables.filter(v => v.type === 'numerical').map(v => v.name),
      categoricalVariables: variables.filter(v => v.type === 'categorical').map(v => v.name)
    });
  };

  return (
    <div className="max-w-xl mx-auto p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-400 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-4 shadow-sm hover:shadow-xl hover:-translate-y-1"
         onClick={() => fileInputRef.current?.click()}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".csv, .xlsx, .xls" 
        onChange={handleFileChange} 
      />
      <div className="p-5 bg-blue-50 rounded-2xl group-hover:bg-blue-100 transition-colors shadow-inner">
        <Upload className="w-10 h-10 text-blue-600" />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-slate-800">Upload Your Dataset</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-xs">Supported formats: CSV, Excel (.xlsx, .xls). Data is processed entirely in your browser.</p>
      </div>
      {isLoading && (
        <div className="flex items-center space-x-3 text-blue-600 bg-blue-50 px-4 py-2 rounded-full">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold">Analyzing Statistics...</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
