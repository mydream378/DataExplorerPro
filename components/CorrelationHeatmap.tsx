
import React from 'react';
import { CorrelationResult } from '../types';

interface CorrelationHeatmapProps {
  results: CorrelationResult[];
  variables: string[];
}

const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ results, variables }) => {
  const getColor = (r: number) => {
    const alpha = Math.abs(r);
    return r > 0 ? `rgba(59, 130, 246, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
  };

  const getTextColor = (r: number) => (Math.abs(r) > 0.5 ? 'white' : 'inherit');

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border border-slate-200"></th>
            {variables.map(v => (
              <th key={v} className="p-2 border border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50 uppercase tracking-wider min-w-[80px]">
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variables.map(yVar => (
            <tr key={yVar}>
              <th className="p-2 border border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50 text-left uppercase tracking-wider">
                {yVar}
              </th>
              {variables.map(xVar => {
                const res = results.find(r => r.x === xVar && r.y === yVar);
                if (!res) return <td key={xVar} className="border border-slate-200"></td>;
                
                return (
                  <td 
                    key={xVar} 
                    className="border border-slate-200 p-0 text-center relative group"
                    style={{ backgroundColor: getColor(res.r) }}
                  >
                    <div className="py-4 px-2 cursor-help" style={{ color: getTextColor(res.r) }}>
                      <div className="text-sm font-bold">{res.r.toFixed(2)}</div>
                      <div className="text-xs opacity-80 h-4">{res.significance}</div>
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute z-10 hidden group-hover:block bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg -translate-y-full left-1/2 -translate-x-1/2 mt-[-4px] whitespace-nowrap">
                      r = {res.r.toFixed(4)}<br/>
                      p = {res.p.toFixed(4)}<br/>
                      n = {res.n}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-end space-x-6 text-xs text-slate-500 italic">
        <div className="flex items-center space-x-1">
          <span>* p &lt; 0.05</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>** p &lt; 0.01</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>*** p &lt; 0.001</span>
        </div>
      </div>
    </div>
  );
};

export default CorrelationHeatmap;
