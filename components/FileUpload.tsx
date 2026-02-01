
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
      const values = rows.map(r => r[h]);
      const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
      let type: VariableType = 'unknown';
      
      if (nonNull.length > 0) {
        const isNumeric = nonNull.every(v => typeof v === 'number' || (!isNaN(Number(v)) && typeof v !== 'boolean'));
        type = isNumeric ? 'numerical' : 'categorical';
      }

      return {
        name: h,
        type,
        values,
        stats: calculateSummaryStats(values, type)
      };
    });

    onDataLoaded({
      filename,
      data: rows,
      variables,
      numericalVariables: variables.filter(v => v.type === 'numerical').map(v => v.name),
      categoricalVariables: variables.filter(v => v.type === 'categorical').map(v => v.name)
    });
  };

  return (
    <div className="max-w-xl mx-auto p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors cursor-pointer group flex flex-col items-center justify-center space-y-4"
         onClick={() => fileInputRef.current?.click()}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".csv, .xlsx, .xls" 
        onChange={handleFileChange} 
      />
      <div className="p-4 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
        <Upload className="w-8 h-8 text-blue-600" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800">Import Epidemiological Data</h3>
        <p className="text-sm text-slate-500 mt-1">Upload CSV or Excel (.xlsx, .xls) files</p>
      </div>
      {isLoading && (
        <div className="flex items-center space-x-2 text-blue-600">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Processing Dataset...</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
