
import React, { useState, useMemo, useRef } from 'react';
import { 
  Activity, 
  BarChart3, 
  LayoutDashboard, 
  RefreshCcw, 
  PieChart, 
  FileText,
  Search,
  ChevronRight,
  Target,
  Download,
  Layers,
  FlaskConical,
  ArrowRightLeft,
  ClipboardCheck,
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
  MousePointerClick
} from 'lucide-react';
import { Dataset, DataVariable } from './types';
import FileUpload from './components/FileUpload';
import DistributionPlot from './components/DistributionPlot';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import { getCorrelationMatrix, calculateGroupStats } from './utils/statistics';
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

  const handleDownload = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    try {
      setLoading(true);
      const element = ref.current;
      const table = element.querySelector('table');
      
      const options = { 
        backgroundColor: '#ffffff', 
        quality: 1,
        pixelRatio: 2,
        width: table ? table.scrollWidth + 100 : element.scrollWidth + 100,
        height: table ? table.scrollHeight + 100 : element.scrollHeight + 100,
        style: { transform: 'none', overflow: 'visible', margin: '0' }
      };

      const dataUrl = await htmlToImage.toPng(element, options);
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
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
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                <Activity className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">EpiExplorer</span>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-500">
              <a href="#aims" className="hover:text-blue-600 transition-colors">Aims</a>
              <a href="#features" className="hover:text-blue-600 transition-colors">Functions</a>
              <a href="#how-to" className="hover:text-blue-600 transition-colors">How-to</a>
            </div>
          </div>
        </header>

        <section className="relative pt-20 pb-16 px-6 overflow-hidden text-center">
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                <Zap className="w-3 h-3" />
                <span>Fast Epidemiology Exploratory Data Analysis</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-tight">
                EDA Optimized for <span className="text-blue-600">Epidemiology.</span>
              </h1>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                Zero-code preliminary screening. Instantly visualize distributions, check significance, and generate publication-ready correlation matrices.
              </p>
            </div>
            <div className="py-8">
              <FileUpload onDataLoaded={handleDataLoaded} isLoading={loading} />
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest mt-12">
              <div className="flex items-center space-x-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span>Secure Browser-Only Analysis</span></div>
              <div className="flex items-center space-x-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span>Privacy-First: No Data Uploads to Servers</span></div>
              <div className="flex items-center space-x-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span>Vercel Optimized SPA</span></div>
            </div>
          </div>
        </section>

        <section id="aims" className="py-24 px-6 bg-white border-y border-slate-100 scroll-mt-20">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center"><BookOpen className="w-6 h-6 text-indigo-600" /></div>
              <h2 className="text-4xl font-extrabold text-slate-900">Project Aims</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                EpiExplorer addresses the bottleneck in initial data screening. Epidemiologists often waste hours writing R scripts just to find basic associations or missingness patterns. 
              </p>
              <ul className="space-y-4">
                {["Accelerate initial variable screening.", "Provide instantaneous p-value analysis.", "Enable clean, subset-based matrix visualization.", "Bridge raw data and academic draft results."].map((aim, i) => (
                  <li key={i} className="flex items-start space-x-3 text-slate-700 font-medium">
                    <ChevronRight className="w-5 h-5 text-emerald-500 mt-1 flex-shrink-0" />
                    <span>{aim}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl rotate-1">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-white/40 text-[10px] font-bold uppercase tracking-widest">
                  <span>Statistical Engine Status</span>
                  <span className="text-emerald-400">Online</span>
                </div>
                <div className="h-4 w-full bg-white/10 rounded animate-pulse"></div>
                <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse delay-75"></div>
                <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse delay-150"></div>
                <div className="mt-8 grid grid-cols-2 gap-4">
                   <div className="h-24 bg-blue-500/20 rounded-2xl border border-blue-500/30"></div>
                   <div className="h-24 bg-emerald-500/20 rounded-2xl border border-emerald-500/30"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 px-6 max-w-6xl mx-auto scroll-mt-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold text-slate-900">Core Analytical Functions</h2>
            <p className="text-slate-500 max-w-xl mx-auto">A purpose-built suite for variable screening and association testing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <BarChart3 className="text-blue-600" />, title: "Automated Distributions", desc: "Instantly detect variable types and visualize histograms or category frequencies with missing data analysis." },
              { icon: <RefreshCcw className="text-emerald-600" />, title: "Significance Heatmaps", desc: "Correlation matrices featuring Pearson's r and significance markers (* < 0.05, ** < 0.01, *** < 0.001) for all numerical columns." },
              { icon: <PieChart className="text-indigo-600" />, title: "Bivariate Deep Dive", desc: "Automated ANOVA and T-tests for focused X-Y analysis, paired with APA-style academic drafting for your results section." }
            ].map((feat, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">{feat.icon}</div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{feat.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-to" className="py-24 px-6 bg-slate-900 text-white rounded-[3rem] mx-6 mb-12 scroll-mt-20">
          <div className="max-w-5xl mx-auto space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-extrabold">How-To Guide</h2>
              <p className="text-slate-400">Go from raw file to research insight in three simple steps.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
               {[
                 { icon: <FileSpreadsheet className="text-blue-400" />, title: "1. Upload File", desc: "Import .csv or .xlsx. All processing is local; your data stays in your browser." },
                 { icon: <MousePointerClick className="text-emerald-400" />, title: "2. Manage Variables", desc: "Use the manager to select subsets of variables. This keeps performance high even for 100+ columns." },
                 { icon: <ClipboardCheck className="text-indigo-400" />, title: "3. Explore & Export", desc: "Analyze correlations, zoom the matrix, and copy the 'Academic Draft' for your manuscript." }
               ].map((step, i) => (
                 <div key={i} className="space-y-6 group">
                   <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl font-black group-hover:bg-blue-600 transition-colors">
                     {step.icon}
                   </div>
                   <div className="space-y-2">
                     <h4 className="text-xl font-bold">{step.title}</h4>
                     <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </section>
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
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard className="w-4 h-4" /><span>Dashboard</span></button>
          <button onClick={() => setActiveTab('univariate')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'univariate' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}><BarChart3 className="w-4 h-4" /><span>Distributions</span></button>
          <button onClick={() => setActiveTab('bivariate')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'bivariate' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}><RefreshCcw className="w-4 h-4" /><span>Correlation</span></button>
          <button onClick={() => setActiveTab('focused')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'focused' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}><PieChart className="w-4 h-4" /><span>Focused Analysis</span></button>
          <div className="pt-6 pb-2">
             <div className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Analysis Config</div>
             <button onClick={() => setIsVarSelectorOpen(true)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border ${isVarSelectorOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
               <div className="flex items-center space-x-3"><Settings2 className="w-4 h-4" /><span>Manage Vars</span></div>
               <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">{selectedVarNames.size}</span>
             </button>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-700 truncate mb-2">{dataset.filename}</p>
            <button onClick={reset} className="w-full text-xs font-medium text-red-500 hover:text-red-600 py-1 bg-white border border-red-100 rounded">Reset Session</button>
          </div>
        </div>
      </aside>

      {isVarSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div><h3 className="text-xl font-bold text-slate-900">Manage Variables</h3><p className="text-sm text-slate-500">Pick which columns to include in analysis tabs.</p></div>
              <button onClick={() => setIsVarSelectorOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Filter variables..." value={varSearchQuery} onChange={(e) => setVarSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg">Select All</button>
                  <button onClick={deselectAll} className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg">Clear</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 content-start custom-scrollbar">
                {searchedVariables.map(v => (
                  <button key={v.name} onClick={() => toggleVariable(v.name)} className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all ${selectedVarNames.has(v.name) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                    {selectedVarNames.has(v.name) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                    <div className="flex-1 overflow-hidden"><p className="text-sm font-semibold text-slate-800 truncate">{v.name}</p><p className="text-[10px] uppercase font-bold text-slate-400">{v.type}</p></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">{selectedVarNames.size} variables selected</p>
              <button onClick={() => setIsVarSelectorOpen(false)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">Apply Subset</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedVarNames.size} selected</span>
              <button onClick={() => setIsVarSelectorOpen(true)} className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-400"><Filter className="w-4 h-4" /><span>Filter Set</span></button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVariables.map(v => (
                <div key={v.name} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 truncate mb-1" title={v.name}>{v.name}</h4>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${v.type === 'numerical' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{v.type}</span>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[11px] font-semibold"><span className="text-slate-400 uppercase">Missingness</span><span>{v.stats.missing} ({((v.stats.missing / dataset.data.length) * 100).toFixed(1)}%)</span></div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full" style={{ width: `${((v.stats.count / dataset.data.length) * 100)}%` }}></div></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'univariate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {filteredVariables.map(v => (
                <div key={v.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-800 mb-4">{v.name}</h3><DistributionPlot variable={v} /></div>
              ))}
            </div>
          )}

          {activeTab === 'bivariate' && (
            <div className="space-y-4">
              {filteredNumericNames.length < 2 ? (
                <div className="bg-amber-50 p-8 rounded-2xl border border-amber-200 text-center"><h3 className="text-lg font-bold text-amber-800">Add at least 2 numerical variables.</h3></div>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center space-x-2 bg-slate-100 rounded-xl p-1">
                      <button onClick={() => setMatrixScale(Math.max(0.4, matrixScale - 0.1))} className="p-2 hover:bg-white rounded-lg transition-all text-slate-600"><Minus className="w-4 h-4" /></button>
                      <div className="px-4 text-xs font-black text-slate-500">{Math.round(matrixScale * 100)}%</div>
                      <button onClick={() => setMatrixScale(Math.min(2.0, matrixScale + 0.1))} className="p-2 hover:bg-white rounded-lg transition-all text-slate-600"><Plus className="w-4 h-4" /></button>
                    </div>
                    <button onClick={() => handleDownload(heatmapRef, 'correlation-matrix')} className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 text-sm font-bold"><Download className="w-4 h-4" /><span>Download Full Matrix</span></button>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div ref={heatmapRef} className="p-6 overflow-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
                      <CorrelationHeatmap results={correlationResults} variables={filteredNumericNames} scale={matrixScale} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'focused' && (
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-end mb-8">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Independent Variable (X)</label>
                    <select value={xVar} onChange={(e) => setXVar(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium">
                      {dataset.variables.filter(v => selectedVarNames.has(v.name)).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setXAsCategorical(!xAsCategorical)} className={`px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all flex items-center space-x-2 border h-[50px] ${xAsCategorical ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100' : 'bg-white text-slate-500 border-slate-200'}`}><Layers className="w-4 h-4" /><span>{xAsCategorical ? 'Categorical Mode' : 'Numerical Mode'}</span></button>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Dependent Variable (Y)</label>
                    <select value={yVar} onChange={(e) => setYVar(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium">
                      {dataset.numericalVariables.filter(v => selectedVarNames.has(v)).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <button onClick={() => handleDownload(scatterRef, `focused-analysis-${xVar}-${yVar}`)} className="flex items-center space-x-2 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 shadow-md text-sm font-bold h-[50px]"><Download className="w-4 h-4" /><span>Export Plot</span></button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div ref={scatterRef} className="lg:col-span-2 bg-slate-50 rounded-2xl p-6 relative border border-slate-100 min-h-[500px]">
                    <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-md min-w-[200px]">
                       {xAsCategorical ? (
                         groupStats && <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupStats.test}</p><p className="text-xl font-black text-slate-900">p = {groupStats.p < 0.001 ? '< 0.001' : groupStats.p.toFixed(3)}</p></div>
                       ) : (
                         (() => {
                            const res = correlationResults.find(r => r.x === xVar && r.y === yVar);
                            return res ? <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pearson r</p><p className="text-xl font-black text-slate-900">{res.r.toFixed(3)} {res.significance}</p></div> : null;
                         })()
                       )}
                    </div>
                    <div className="h-[460px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {xAsCategorical ? (
                          <BarChart data={dataset.data} margin={{ top: 110, right: 30, left: 20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey={xVar} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey={yVar} fill="#10b981" radius={[6, 6, 0, 0]} barSize={60} />
                          </BarChart>
                        ) : (
                          <ScatterChart margin={{ top: 110, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" dataKey="x" name={xVar} /><YAxis type="number" dataKey="y" name={yVar} /><ZAxis type="number" range={[50, 50]} /><Tooltip /><Scatter name="Observations" data={focusedScatterData} fill="#3b82f6" fillOpacity={0.4} stroke="#2563eb" />
                          </ScatterChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 border-b pb-3 flex items-center"><FlaskConical className="w-4 h-4 mr-2 text-indigo-500" />Evidence</h4>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">P-value</p>
                        <p className="text-2xl font-black text-slate-900">{xAsCategorical ? groupStats?.p.toFixed(4) : correlationResults.find(r => r.x === xVar && r.y === yVar)?.p.toFixed(4) || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {academicSummaryText && (
                  <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-600">
                    <div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Academic Results Draft</h4><button onClick={() => { navigator.clipboard.writeText(academicSummaryText); }} className="px-3 py-1 bg-white border rounded-lg text-xs font-semibold text-slate-600 hover:bg-blue-50 transition-colors">Copy to Clipboard</button></div>
                    <div className="p-8 relative"><Quote className="absolute top-4 left-4 w-12 h-12 text-slate-100 -z-0" /><div className="relative z-10 text-slate-700 leading-relaxed text-sm font-serif italic">{academicSummaryText}</div></div>
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
