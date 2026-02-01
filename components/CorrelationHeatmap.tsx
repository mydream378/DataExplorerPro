
import React from 'react';
import { CorrelationResult } from '../types';

interface CorrelationHeatmapProps {
  results: CorrelationResult[];
  variables: string[];
  scale?: number;
}

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ results, variables, scale = 1 }) => {
  const getColor = (r: number) => {
    const alpha = Math.abs(r);
    return r > 0 ? `rgba(59, 130, 246, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
  };

  const getTextColor = (r: number) => (Math.abs(r) > 0.6 ? 'white' : 'inherit');

  // Dynamic styles based on scale
  const cellPadding = `${Math.max(4, 16 * scale)}px ${Math.max(2, 8 * scale)}px`;
  const fontSizeMain = `${Math.max(8, 14 * scale)}px`;
  const fontSizeSub = `${Math.max(6, 10 * scale)}px`;
  const minCellWidth = `${Math.max(40, 80 * scale)}px`;

  return (
    <div className="w-full">
      <div className="inline-block min-w-full align-middle">
        <table className="border-collapse table-fixed bg-white" style={{ width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 p-2 border border-slate-200 bg-slate-50 min-w-[100px]" style={{ width: minCellWidth }}></th>
              {variables.map(v => (
                <th 
                  key={v} 
                  className="p-2 border border-slate-200 font-semibold text-slate-600 bg-slate-50 uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ minWidth: minCellWidth, fontSize: fontSizeSub }}
                  title={v}
                >
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variables.map(yVar => (
              <tr key={yVar}>
                <th 
                  className="sticky left-0 z-10 p-2 border border-slate-200 font-semibold text-slate-600 bg-slate-50 text-left uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ fontSize: fontSizeSub, width: minCellWidth }}
                  title={yVar}
                >
                  {yVar}
                </th>
                {variables.map(xVar => {
                  const res = results.find(r => r.x === xVar && r.y === yVar);
                  if (!res) return <td key={xVar} className="border border-slate-200"></td>;
                  
                  return (
                    <td 
                      key={xVar} 
                      className="border border-slate-200 p-0 text-center relative group transition-colors duration-200"
                      style={{ backgroundColor: getColor(res.r) }}
                    >
                      <div className="cursor-help flex flex-col items-center justify-center h-full" style={{ padding: cellPadding, color: getTextColor(res.r) }}>
                        <div className="font-bold leading-none" style={{ fontSize: fontSizeMain }}>{res.r.toFixed(2)}</div>
                        <div className="opacity-80 font-medium" style={{ fontSize: fontSizeSub, height: '1em', marginTop: '2px' }}>{res.significance}</div>
                      </div>
                      {/* Tooltip on hover */}
                      <div className="absolute z-30 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-xl -translate-y-full left-1/2 -translate-x-1/2 mt-[-8px] whitespace-nowrap pointer-events-none">
                        <div className="font-bold border-b border-white/20 mb-1 pb-1">{xVar} &times; {yVar}</div>
                        <div>r = {res.r.toFixed(4)}</div>
                        <div>p = {res.p.toFixed(4)}</div>
                        <div>n = {res.n}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex items-center justify-end space-x-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-200"></span>
          <span>* p &lt; 0.05</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          <span>** p &lt; 0.01</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>*** p &lt; 0.001</span>
        </div>
      </div>
    </div>
  );
};

export default CorrelationHeatmap;
