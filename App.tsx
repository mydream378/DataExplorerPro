
import React, { useState, useMemo, useRef } from 'react';
import { 
  Activity, 
  BarChart3, 
  LayoutDashboard, 
  RefreshCcw, 
  PieChart, 
  Search,
  ChevronRight,
  Download,
  Layers,
  FlaskConical,
  Quote,
  CheckSquare,
  Square,
  Settings2,
  Filter,
  X,
  ShieldCheck,
  Zap,
  BookOpen,
  Plus,
  Minus,
  FileSpreadsheet,
  MousePointerClick,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Target,
  ClipboardCheck
} from 'lucide-react';
import { Dataset, DataVariable } from './types';
import FileUpload from './components/FileUpload';
import DistributionPlot from './components/DistributionPlot';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import { getCorrelationMatrix, calculateGroupStats, calculateSummaryStats } from './utils/statistics';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, BarChart, Bar, ErrorBar } from 'recharts';
import * as htmlToImage from 'html-to-image';

type Tab = 'overview' | 'univariate' | 'bivariate' | 'focused';

const App: React.FC = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  
  const [selectedVarNames, setSelectedVarNames] = useState<Set<string>>(new Set());
  const [isVarSelectorOpen, setIsVarSelectorOpen] = useState(false);
  const [varSearchQuery, setVarSearchQuery] = useState('');
  const [matrixScale, setMatrixScale] = useState(1);

  const [xVar, setXVar] = useState<string>('');
  const [yVar, setYVar] = useState<string>('');
  const [xAsCategorical, setXAsCategorical] = useState<boolean>(false);

  const heatmapRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);

  const filteredVariables = useMemo(() => {
    if (!dataset) return [];
    return dataset.variables.filter(v => selectedVarNames.has(v.name));
  }, [dataset, selectedVarNames]);

  const filteredNumericNames = useMemo(() => {
    return filteredVariables.filter(v => v.type === 'numerical').map(v => v.name);
  }, [filteredVariables]);

  const correlationResults = useMemo(() => {
    if (!dataset || filteredNumericNames.length < 2) return [];
    return getCorrelationMatrix(dataset.data, filteredNumericNames);
  }, [dataset, filteredNumericNames]);

  const handleDataLoaded = (data: Dataset) => {
    setLoading(true);
    setDataset(data);
    
    const initialSelection = new Set<string>();
    const limit = data.variables.length > 50 ? 20 : data.variables.length;
    data.variables.slice(0, limit).forEach(v => initialSelection.add(v.name));
    setSelectedVarNames(initialSelection);

    const numericOnly = data.variables.filter(v => v.type === 'numerical').map(v => v.name);
    if (numericOnly.length >= 2) {
      setXVar(numericOnly[0]);
      setYVar(numericOnly[1]);
    } else if (data.variables.length >= 2) {
      setXVar(data.variables[0].name);
      setYVar(data.variables[1].name);
    }

    setTimeout(() => {
      setLoading(false);
      setActiveTab('overview');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500);
  };

  /**
   * Aggressively forces variables to be numerical if they contain ANY numeric content.
   * This handles cases where mixed text/numbers caused the parser to default to categorical.
   */
  const forceNumericalAll = () => {
    if (!dataset) return;
    
    setLoading(true);
    
    const updatedVariables = dataset.variables.map(v => {
      const nonNullValues = v.values.filter(val => val !== null && val !== undefined && String(val).trim() !== '');
      
      // Force anything that has at least 10% numeric content or if the user specifically requested it
      const numericCount = nonNullValues.filter(val => !isNaN(parseFloat(String(val)))).length;
      const shouldBeNumeric = numericCount > 0 && (numericCount / nonNullValues.length) > 0.1;

      if (shouldBeNumeric || v.type === 'numerical') {
        const numericValues = v.values.map(val => {
          if (val === null || val === undefined || String(val).trim() === '') return null;
          const parsed = parseFloat(String(val));
          return isNaN(parsed) ? null : parsed;
        });

        return {
          ...v,
          type: 'numerical' as const,
          values: numericValues,
          stats: calculateSummaryStats(numericValues, 'numerical')
        };
      }
      return v;
    });

    const updatedData = dataset.data.map(row => {
      const newRow = { ...row };
      updatedVariables.forEach(v => {
        if (v.type === 'numerical') {
          const val = row[v.name];
          if (val !== null && val !== undefined) {
            const parsed = parseFloat(String(val));
            newRow[v.name] = isNaN(parsed) ? null : parsed;
          }
        }
      });
      return newRow;
    });

    setDataset({
      ...dataset,
      data: updatedData,
      variables: updatedVariables,
      numericalVariables: updatedVariables.filter(v => v.type === 'numerical').map(v => v.name),
      categoricalVariables: updatedVariables.filter(v => v.type === 'categorical').map(v => v.name)
    });
    
    setLoading(false);
    alert('Variable re-classification complete. Variables with numeric content are now available for correlation analysis.');
  };

  const toggleVariable = (name: string) => {
    const newSelection = new Set(selectedVarNames);
    if (newSelection.has(name)) newSelection.delete(name);
    else newSelection.add(name);
    setSelectedVarNames(newSelection);
  };

  const selectAll = () => {
    if (!dataset) return;
    setSelectedVarNames(new Set(dataset.variables.map(v => v.name)));
  };

  const deselectAll = () => {
    setSelectedVarNames(new Set());
  };

  /**
   * Captures the correlation matrix as an editable HTML table for Microsoft Word.
   */
  const handleCopyTableForWord = async () => {
    if (!filteredNumericNames.length) return;

    let html = `<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 10pt;">`;
    
    // Header Row
    html += `<tr style="background-color: #f1f5f9;">`;
    html += `<th style="padding: 8px; border: 1px solid #cbd5e1;">Variable</th>`;
    filteredNumericNames.forEach(name => {
      html += `<th style="padding: 8px; border: 1px solid #cbd5e1;">${name}</th>`;
    });
    html += `</tr>`;

    // Data Rows
    filteredNumericNames.forEach(yVar => {
      html += `<tr>`;
      html += `<td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; background-color: #f8fafc;">${yVar}</td>`;
      filteredNumericNames.forEach(xVar => {
        const res = correlationResults.find(r => r.x === xVar && r.y === yVar);
        const val = res ? `${res.r.toFixed(3)}${res.significance}` : '-';
        html += `<td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${val}</td>`;
      });
      html += `</tr>`;
    });
    html += `</table>`;

    try {
      const blob = new Blob([html], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob })];
      await navigator.clipboard.write(data);
      alert('Table copied! You can now paste directly into Microsoft Word.');
    } catch (err) {
      console.error('Failed to copy table', err);
      // Fallback for browsers that don't support ClipboardItem for HTML
      const tempElement = document.createElement('div');
      tempElement.innerHTML = html;
      tempElement.style.position = 'fixed';
      tempElement.style.left = '-9999px';
      document.body.appendChild(tempElement);
      const range = document.createRange();
      range.selectNode(tempElement);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      document.execCommand('copy');
      document.body.removeChild(tempElement);
      alert('Table copied using fallback. You can now paste into Word.');
    }
  };

  const handleDownload = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      setLoading(true);
      const element = ref.current;
      
      const target = element.querySelector('table') || element;
      const fullWidth = target.scrollWidth;
      const fullHeight = target.scrollHeight;

      const ratio = (fullWidth * 2 > 12000 || fullHeight * 2 > 12000) ? 1 : 2;
      
      const options = { 
        backgroundColor: '#ffffff', 
        quality: 1,
        pixelRatio: ratio,
        width: fullWidth + 40,
        height: fullHeight + 40,
        style: { 
          transform: 'none', 
          overflow: 'visible', 
          margin: '0',
          padding: '20px'
        }
      };

      const dataUrl = await htmlToImage.toPng(target, options);
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
      alert('Export failed. The matrix may be too large for your browser to process as a single image.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setDataset(null);
    setActiveTab('overview');
    setXAsCategorical(false);
    setSelectedVarNames(new Set());
    setMatrixScale(1);
  };

  const focusedScatterData = useMemo(() => {
    if (!dataset || !xVar || !yVar) return [];
    return dataset.data
      .map(row => ({ x: row[xVar], y: row[yVar] }))
      .filter(p => p.x !== null && p.x !== undefined && p.y !== null && p.y !== undefined);
  }, [dataset, xVar, yVar]);

  const groupStats = useMemo(() => {
    if (!dataset || !xVar || !yVar || !xAsCategorical) return null;
    const groups: Record<string, number[]> = {};
    dataset.data.forEach(row => {
      const xVal = row[xVar] === null || row[xVar] === undefined ? 'Missing' : String(row[xVar]);
      const yVal = Number(row[yVar]);
      if (xVal !== 'Missing' && !isNaN(yVal)) {
        if (!groups[xVal]) groups[xVal] = [];
        groups[xVal].push(yVal);
      }
    });
    return calculateGroupStats(groups);
  }, [dataset, xVar, yVar, xAsCategorical]);

  const academicSummaryText = useMemo(() => {
    if (!dataset || !xVar || !yVar) return "";
    if (xAsCategorical && groupStats) {
      const isSig = groupStats.p < 0.05;
      const pText = groupStats.p < 0.001 ? "p < .001" : `p = ${groupStats.p.toFixed(3)}`;
      let text = `A ${groupStats.test.toLowerCase()} was performed to examine the effect of ${xVar} on ${yVar}. `;
      text += `Results indicated a statistically ${isSig ? "significant" : "non-significant"} effect, F(${groupStats.dfB}, ${groupStats.dfW}) = ${groupStats.f.toFixed(2)}, ${pText}, η² = ${groupStats.etaSq.toFixed(3)}. `;
      const groupMeans = groupStats.groups.map(g => `${g.name} (M = ${g.mean.toFixed(2)}, SD = ${Math.sqrt(g.variance).toFixed(2)})`).join(", ");
      text += `Descriptive statistics showed the following group means: ${groupMeans}.`;
      return text;
    } else if (!xAsCategorical) {
      const res = correlationResults.find(r => r.x === xVar && r.y === yVar);
      if (!res) return "";
      const isSig = res.p < 0.05;
      const pText = res.p < 0.001 ? "p < .001" : `p = ${res.p.toFixed(3)}`;
      const direction = res.r > 0 ? "positive" : "negative";
      const magnitude = Math.abs(res.r) > 0.7 ? "strong" : Math.abs(res.r) > 0.3 ? "moderate" : "weak";
      const df = res.n - 2;
      let text = `The association between ${xVar} and ${yVar} was evaluated using Pearson's product-moment correlation coefficient. `;
      text += `A ${magnitude} ${direction} correlation was observed between the variables, r(${df}) = ${res.r.toFixed(3)}, ${pText}. `;
      if (isSig) {
        text += `This indicates that higher levels of ${xVar} are significantly associated with ${res.r > 0 ? "higher" : "lower"} values of ${yVar}.`;
      }
      return text;
    }
    return "";
  }, [xVar, yVar, xAsCategorical, groupStats, correlationResults, dataset]);

  const searchedVariables = useMemo(() => {
    if (!dataset) return [];
    return dataset.variables.filter(v => v.name.toLowerCase().includes(varSearchQuery.toLowerCase()));
  }, [dataset, varSearchQuery]);

  if (!dataset) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                <Activity className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">EpiExplorer</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8 text-sm font-bold text-slate-500">
              <a href="#aims" className="hover:text-blue-600 transition-colors">Aims</a>
              <a href="#features" className="hover:text-blue-600 transition-colors">Functions</a>
              <a href="#how-to" className="hover:text-blue-600 transition-colors">How-to</a>
            </nav>
          </div>
        </header>

        <main>
          <section className="relative pt-24 pb-16 px-6 overflow-hidden text-center bg-gradient-to-b from-white to-slate-50">
            <div className="max-w-5xl mx-auto space-y-8 relative z-10">
              <div className="space-y-6">
                <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100 shadow-sm mb-4">
                  <Zap className="w-4 h-4" />
                  <span>Epidemiology Toolkit</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1]">
                  Better EDA for <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Epidemiologists.</span>
                </h1>
                <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-medium">
                  The zero-code solution for preliminary screening. Import messy datasets, force numeric types for associations, and generate publication-quality stats instantly.
                </p>
              </div>
              <div className="py-12">
                <FileUpload onDataLoaded={handleDataLoaded} isLoading={loading} />
              </div>
              <div className="flex flex-wrap justify-center gap-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-12">
                <div className="flex items-center space-x-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span>Secure Browser Analysis</span></div>
                <div className="flex items-center space-x-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span>Privacy-First: No Server Uploads</span></div>
                <div className="flex items-center space-x-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span>Vercel Optimized SPA</span></div>
              </div>
            </div>
          </section>

          <section id="aims" className="py-24 px-6 bg-white border-y border-slate-100 scroll-mt-20">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
              <div className="space-y-8">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shadow-inner"><BookOpen className="w-7 h-7 text-blue-600" /></div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Project Aims</h2>
                <p className="text-lg text-slate-600 leading-relaxed font-medium">
                  EpiExplorer bridges the gap between raw data collection and academic insights. Writing R scripts for basic missingness checks or correlations is time-consuming—we automate it.
                </p>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    "Zero-code screening for variable associations.",
                    "Instant correction of misclassified numeric columns.",
                    "Standardized significance reporting (p-values, Stars).",
                    "Automated drafting of academic results in APA style."
                  ].map((aim, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-colors hover:bg-white hover:border-blue-200">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-black shadow-lg shadow-blue-200">{i+1}</div>
                      <span className="text-slate-700 font-bold">{aim}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-blue-100/50 rounded-[3rem] blur-2xl -z-10"></div>
                <div className="bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 group transition-transform hover:scale-[1.02]">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                      <span>Real-time Engine</span>
                      <span className="flex items-center space-x-2"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span><span className="text-emerald-400">Online</span></span>
                    </div>
                    <div className="space-y-3">
                       <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500 w-3/4 animate-in slide-in-from-left duration-1000"></div></div>
                       <div className="h-3 w-2/3 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 w-1/2 animate-in slide-in-from-left delay-300 duration-1000"></div></div>
                    </div>
                    <div className="mt-12 grid grid-cols-2 gap-4">
                       <div className="aspect-square bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-2 group-hover:bg-blue-600/10 group-hover:border-blue-500/30 transition-all">
                          <Activity className="text-blue-400 w-8 h-8" />
                          <span className="text-white font-bold text-xs">P-Value Calc</span>
                       </div>
                       <div className="aspect-square bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-2 group-hover:bg-emerald-600/10 group-hover:border-emerald-500/30 transition-all">
                          <RefreshCcw className="text-emerald-400 w-8 h-8" />
                          <span className="text-white font-bold text-xs">Matrix Scan</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="py-24 px-6 max-w-6xl mx-auto scroll-mt-20">
            <div className="text-center mb-20 space-y-4">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Analytical Functions</h2>
              <p className="text-slate-500 max-w-xl mx-auto font-medium">A specialized suite designed for epidemiological variable screening.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { icon: <BarChart3 className="text-blue-600" />, title: "Distributions", desc: "Automated histograms and missing data analysis for categorical and numeric variables." },
                { icon: <RefreshCcw className="text-emerald-600" />, title: "Correlation Matrices", desc: "Interactive heatmaps with standard significance markers (*, **, ***) and Pearson's r." },
                { icon: <PieChart className="text-indigo-600" />, title: "Focused Stats", desc: "Subset comparison using ANOVA and Independent T-tests with automated result drafting." }
              ].map((feat, i) => (
                <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all hover:-translate-y-2 group">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-blue-50 transition-colors">{feat.icon}</div>
                  <h4 className="text-2xl font-black text-slate-900 mb-4">{feat.title}</h4>
                  <p className="text-slate-500 leading-relaxed font-medium">{feat.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 sticky top-0 h-screen flex flex-col z-40">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
          <Activity className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-slate-800 tracking-tight text-lg">EpiExplorer</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard className="w-5 h-5" /><span>Dashboard</span></button>
          <button onClick={() => setActiveTab('univariate')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'univariate' ? 'bg-blue-50 text-blue-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><BarChart3 className="w-5 h-5" /><span>Distributions</span></button>
          <button onClick={() => setActiveTab('bivariate')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'bivariate' ? 'bg-blue-50 text-blue-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><RefreshCcw className="w-5 h-5" /><span>Correlation</span></button>
          <button onClick={() => setActiveTab('focused')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'focused' ? 'bg-blue-50 text-blue-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><PieChart className="w-5 h-5" /><span>Focused Analysis</span></button>
          <div className="pt-8 pb-2">
             <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Configuration</div>
             <button onClick={() => setIsVarSelectorOpen(true)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isVarSelectorOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
               <div className="flex items-center space-x-3"><Settings2 className="w-5 h-5" /><span>Variable Set</span></div>
               <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black">{selectedVarNames.size}</span>
             </button>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-700 truncate mb-3" title={dataset.filename}>{dataset.filename}</p>
            <button onClick={reset} className="w-full text-xs font-bold text-red-500 hover:text-red-600 py-2 bg-white border border-red-100 rounded-xl transition-colors">Clear Project</button>
          </div>
        </div>
      </aside>

      {isVarSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div><h3 className="text-2xl font-black text-slate-900">Variable Manager</h3><p className="text-sm text-slate-500 font-medium">Select columns and define data types.</p></div>
              <button onClick={() => setIsVarSelectorOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            
            <div className="p-8 space-y-6 flex-1 flex flex-col overflow-hidden">
              <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl flex items-start space-x-5 shadow-sm">
                 <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0"><Sparkles className="text-blue-600 w-6 h-6" /></div>
                 <div className="space-y-3">
                    <h4 className="text-sm font-black text-blue-900">Missing Numeric Variables?</h4>
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">If some numeric columns were detected as categorical (e.g., due to "N/A" strings), use this tool to force numeric re-classification for all columns with numeric content.</p>
                    <button 
                      onClick={forceNumericalAll}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center space-x-2 active:scale-95"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Force Numeric Classification</span>
                    </button>
                 </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Search headers..." value={varSearchQuery} onChange={(e) => setVarSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">Select All</button>
                  <button onClick={deselectAll} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Clear All</button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 content-start custom-scrollbar p-1">
                {searchedVariables.map(v => (
                  <button key={v.name} onClick={() => toggleVariable(v.name)} className={`flex items-center space-x-4 p-4 rounded-2xl border text-left transition-all group ${selectedVarNames.has(v.name) ? 'bg-blue-50 border-blue-300 ring-4 ring-blue-50' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                    <div className="flex-shrink-0">
                      {selectedVarNames.has(v.name) ? <CheckSquare className="w-6 h-6 text-blue-600" /> : <Square className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-slate-800 truncate">{v.name}</p>
                      <p className={`text-[9px] uppercase font-black tracking-widest ${v.type === 'numerical' ? 'text-blue-500' : 'text-emerald-500'}`}>{v.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between sticky bottom-0 z-10">
              <p className="text-sm font-bold text-slate-600">{selectedVarNames.size} variables active</p>
              <button onClick={() => setIsVarSelectorOpen(false)} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center space-x-2">
                <span>Update Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex justify-between items-end border-b border-slate-200 pb-6">
            <div className="space-y-1">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight capitalize">{activeTab}</h2>
              <p className="text-slate-500 font-medium">Analyzing {dataset.filename}</p>
            </div>
            <div className="flex items-center space-x-4 mb-1">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-xl">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{filteredNumericNames.length} Numerical Active</span>
              </div>
              <button onClick={() => setIsVarSelectorOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm"><Filter className="w-4 h-4" /><span>Select Columns</span></button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVariables.map(v => (
                <div key={v.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 group">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-slate-800 truncate flex-1 pr-2" title={v.name}>{v.name}</h4>
                    <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-lg ${v.type === 'numerical' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{v.type}</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Missingness</p>
                        <p className="text-sm font-bold text-slate-700">{v.stats.missing} entries</p>
                      </div>
                      <span className="text-sm font-black text-slate-400">{((v.stats.missing / dataset.data.length) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500" style={{ width: `${((v.stats.count / dataset.data.length) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredVariables.length === 0 && (
                <div className="col-span-full py-24 text-center bg-white rounded-[2rem] border-4 border-dashed border-slate-100 flex flex-col items-center">
                  <AlertTriangle className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-slate-400 font-bold text-lg">No variables selected in the Manager.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'univariate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {filteredVariables.map(v => (
                <div key={v.name} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm"><h3 className="text-xl font-black text-slate-800 mb-6">{v.name}</h3><DistributionPlot variable={v} /></div>
              ))}
            </div>
          )}

          {activeTab === 'bivariate' && (
            <div className="space-y-6">
              {filteredNumericNames.length < 2 ? (
                <div className="bg-amber-50 p-16 rounded-[2.5rem] border border-amber-100 text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center mb-6"><Target className="w-10 h-10 text-amber-500" /></div>
                  <h3 className="text-2xl font-black text-amber-900">Insufficient Numerical Data</h3>
                  <p className="text-amber-700 mt-4 max-w-md mx-auto font-medium leading-relaxed">Correlation matrices require at least 2 variables classified as 'numerical'. Use the <strong>Variable Manager</strong> to ensure your data is correctly classified.</p>
                  <button onClick={() => setIsVarSelectorOpen(true)} className="mt-8 px-8 py-3 bg-amber-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-amber-100 hover:bg-amber-700 transition-colors">Adjust Variables</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center space-x-3 bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
                      <button onClick={() => setMatrixScale(Math.max(0.4, matrixScale - 0.1))} className="p-2.5 hover:bg-white rounded-xl transition-all text-slate-600 shadow-sm"><Minus className="w-4 h-4" /></button>
                      <div className="px-5 text-xs font-black text-slate-500 min-w-[60px] text-center">{Math.round(matrixScale * 100)}%</div>
                      <button onClick={() => setMatrixScale(Math.min(2.0, matrixScale + 0.1))} className="p-2.5 hover:bg-white rounded-xl transition-all text-slate-600 shadow-sm"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={handleCopyTableForWord} className="flex items-center space-x-3 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 shadow-sm text-sm font-black transition-all active:scale-95 border border-indigo-100"><ClipboardCheck className="w-4 h-4" /><span>Copy Table for Word</span></button>
                      <button onClick={() => handleDownload(heatmapRef, 'correlation-matrix')} className="flex items-center space-x-3 px-8 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 text-sm font-black transition-all active:scale-95"><Download className="w-4 h-4" /><span>Export High-Res PNG</span></button>
                    </div>
                  </div>
                  <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div ref={heatmapRef} className="p-10 overflow-auto custom-scrollbar" style={{ maxHeight: '75vh' }}>
                      <CorrelationHeatmap results={correlationResults} variables={filteredNumericNames} scale={matrixScale} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'focused' && (
            <div className="space-y-10">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6 items-end mb-10">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Predictor (X Variable)</label>
                    <select value={xVar} onChange={(e) => setXVar(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold appearance-none transition-all focus:ring-4 focus:ring-blue-50 cursor-pointer">
                      {dataset.variables.filter(v => selectedVarNames.has(v.name)).map(v => <option key={v.name} value={v.name}>{v.name} ({v.type})</option>)}
                    </select>
                  </div>
                  <button onClick={() => setXAsCategorical(!xAsCategorical)} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 border h-[56px] shadow-sm ${xAsCategorical ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-100' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}><Layers className="w-5 h-5" /><span>{xAsCategorical ? 'Group Analysis' : 'Scatter Analysis'}</span></button>
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Outcome (Y Variable)</label>
                    <select value={yVar} onChange={(e) => setYVar(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold appearance-none transition-all focus:ring-4 focus:ring-blue-50 cursor-pointer">
                      {dataset.numericalVariables.filter(v => selectedVarNames.has(v)).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <button onClick={() => handleDownload(scatterRef, `epidemiology-plot-${xVar}-${yVar}`)} className="flex items-center space-x-3 px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 shadow-xl shadow-slate-200 text-sm font-black h-[56px] transition-all active:scale-95"><Download className="w-5 h-5" /><span>Save Plot</span></button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div ref={scatterRef} className="lg:col-span-2 bg-slate-50 rounded-[2rem] p-10 relative border border-slate-100 min-h-[550px]">
                    <div className="absolute top-6 left-6 z-20 bg-white/95 backdrop-blur-md p-5 rounded-[1.5rem] border border-slate-200 shadow-xl min-w-[220px]">
                       {xAsCategorical ? (
                         groupStats && <div className="space-y-1.5"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupStats.test}</p><p className="text-2xl font-black text-slate-900">p = {groupStats.p < 0.001 ? '< 0.001' : groupStats.p.toFixed(3)}</p></div>
                       ) : (
                         (() => {
                            const res = correlationResults.find(r => r.x === xVar && r.y === yVar);
                            return res ? <div className="space-y-1.5"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pearson Association</p><p className="text-2xl font-black text-slate-900">{res.r.toFixed(3)} {res.significance}</p></div> : null;
                         })()
                       )}
                    </div>
                    <div className="h-[480px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {xAsCategorical ? (
                          <BarChart data={dataset.data} margin={{ top: 120, right: 30, left: 20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey={xVar} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey={yVar} fill="#10b981" radius={[8, 8, 0, 0]} barSize={50} />
                          </BarChart>
                        ) : (
                          <ScatterChart margin={{ top: 120, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" dataKey="x" name={xVar} /><YAxis type="number" dataKey="y" name={yVar} /><ZAxis type="number" range={[60, 60]} /><Tooltip /><Scatter name="Observations" data={focusedScatterData} fill="#3b82f6" fillOpacity={0.4} stroke="#2563eb" strokeWidth={1} />
                          </ScatterChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-50 pb-4 flex items-center"><FlaskConical className="w-5 h-5 mr-3 text-blue-500" />Statistical Inference</h4>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Confidence Level (p)</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{xAsCategorical ? (groupStats?.p.toFixed(4) || "N/A") : (correlationResults.find(r => r.x === xVar && r.y === yVar)?.p.toFixed(4) || "N/A")}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {academicSummaryText && (
                  <div className="mt-10 bg-white rounded-[2rem] border border-slate-200 shadow-md overflow-hidden border-l-[10px] border-l-blue-600 transition-all hover:shadow-xl">
                    <div className="p-5 bg-slate-50 border-b flex justify-between items-center"><h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Academic Draft Output (APA Style)</h4><button onClick={() => { navigator.clipboard.writeText(academicSummaryText); alert('Copied to clipboard'); }} className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">Copy Draft</button></div>
                    <div className="p-10 relative"><Quote className="absolute top-6 left-6 w-16 h-16 text-slate-100 -z-0" /><div className="relative z-10 text-slate-700 leading-relaxed text-lg font-serif italic">{academicSummaryText}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
