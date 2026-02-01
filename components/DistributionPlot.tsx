
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LabelList 
} from 'recharts';
import { DataVariable } from '../types';

interface DistributionPlotProps {
  variable: DataVariable;
}

const DistributionPlot: React.FC<DistributionPlotProps> = ({ variable }) => {
  const totalCount = variable.stats.count;

  if (variable.type === 'numerical') {
    // Basic histogram logic
    const nums = variable.values.filter(v => typeof v === 'number') as number[];
    if (nums.length === 0) return <div className="h-64 flex items-center justify-center text-slate-400 text-sm italic">No numerical data</div>;

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const binCount = 8;
    const range = max - min;
    const binSize = range / binCount || 1;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: `${(min + i * binSize).toFixed(1)}`,
      count: 0,
      percentage: 0
    }));

    nums.forEach(n => {
      let binIdx = Math.floor((n - min) / binSize);
      if (binIdx >= binCount) binIdx = binCount - 1;
      bins[binIdx].count++;
    });

    bins.forEach(b => {
      b.percentage = totalCount > 0 ? (b.count / totalCount) * 100 : 0;
    });

    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 25, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="bin" tick={{fontSize: 9, fill: '#94a3b8'}} height={30} />
            <YAxis hide />
            <Tooltip 
              cursor={{fill: '#f8fafc'}} 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: number) => [`${value} (${((value / totalCount) * 100).toFixed(1)}%)`, 'N']}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              <LabelList 
                dataKey="count" 
                position="top" 
                style={{ fontSize: '10px', fill: '#475569', fontWeight: '700' }} 
                formatter={(val: number) => val > 0 ? `${val}\n(${((val / totalCount) * 100).toFixed(1)}%)` : ''} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Categorical logic
  const freqs = variable.stats.frequencies || {};
  const data = (Object.entries(freqs) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) 
    .map(([name, count]) => ({ 
      name, 
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
    }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 80, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#64748b'}} width={80} />
          <Tooltip 
            cursor={{fill: '#f8fafc'}} 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: number) => [`${value} (${((value / totalCount) * 100).toFixed(1)}%)`, 'N']}
          />
          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
            <LabelList 
              dataKey="count" 
              position="right" 
              style={{ fontSize: '10px', fill: '#334155', fontWeight: '700' }} 
              // Fix: Recharts LabelList formatter signature mismatch. 
              // Only one argument (value) is reliably provided by the LabelList component.
              // We calculate the percentage using totalCount from the closure scope.
              formatter={(val: number) => `${val} (${((val / totalCount) * 100).toFixed(1)}%)`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DistributionPlot;
