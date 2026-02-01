
import React, { useState, useMemo, useRef } from 'react';
import { 
  Activity, 
  BarChart3, 
  LayoutDashboard, 
  Table as TableIcon, 
  RefreshCcw, 
  PieChart, 
  FileText,
  Search,
  ChevronRight,
  Target,
  Download,
  Info,
  Layers,
  FlaskConical,
  ArrowRightLeft,
  ArrowRight,
  ClipboardCheck,
  Quote
} from 'lucide-react';
import { Dataset, CorrelationResult } from './types';
import FileUpload from './components/FileUpload';
import DistributionPlot from './components/DistributionPlot';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import { getCorrelationMatrix, calculateGroupStats, getSignificanceStars } from './utils/statistics';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, ErrorBar, LabelList } from 'recharts';
import * as htmlToImage from 'html-to-image';

type Tab = 'overview' | 'univariate' | 'bivariate' | 'focused';

const App: React.FC = () => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  
  const [xVar, setXVar] = useState<string>('');
  const [yVar, setYVar] = useState<string>('');
  const [xAsCategorical, setXAsCategorical] = useState<boolean>(false);

  const heatmapRef = useRef<HTMLDivElement>(null);
  const scatterRef = useRef<HTMLDivElement>(null);

  const correlationResults = useMemo(() => {
    if (!dataset || dataset.numericalVariables.length < 2) return [];
    return getCorrelationMatrix(dataset.data, dataset.numericalVariables);
  }, [dataset]);

  const handleDataLoaded = (data: Dataset) => {
    setLoading(true);
    setDataset(data);
    if (data.numericalVariables.length >= 2) {
      setXVar(data.numericalVariables[0]);
      setYVar(data.numericalVariables[1]);
    } else if (data.variables.length >= 2) {
      setXVar(data.variables[0].name);
      setYVar(data.variables[1].name);
    }
    setTimeout(() => {
      setLoading(false);
      setActiveTab('overview');
    }, 500);
  };

  const handleDownload = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (ref.current) {
      try {
        const dataUrl = await htmlToImage.toPng(ref.current, { backgroundColor: '#ffffff', quality: 1 });
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Failed to export image', err);
      }
    }
  };

  const reset = () => {
    setDataset(null);
    setActiveTab('overview');
    setXAsCategorical(false);
  };

  const focusedScatterData = useMemo(() => {
    if (!dataset || !xVar || !yVar) return [];
    return dataset.data
      .map(row => ({ x: row[xVar], y: row[yVar] }))
      .filter(p => typeof p.x === 'number' && typeof p.y === 'number');
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

  const academicSummary = useMemo(() => {
    if (!dataset || !xVar || !yVar) return "";
    
    if (xAsCategorical && groupStats) {
      const isSig = groupStats.p < 0.05;
      const pText = groupStats.p < 0.001 ? "p < .001" : `p = ${groupStats.p.toFixed(3)}`;
      const strength = groupStats.etaSq > 0.14 ? "large" : groupStats.etaSq > 0.06 ? "medium" : "small";
      
      let text = `A ${groupStats.test.toLowerCase()} was performed to examine the effect of ${xVar} on ${yVar}. `;
      text += `Results indicated a statistically ${isSig ? "significant" : "non-significant"} effect, F(${groupStats.dfB}, ${groupStats.dfW}) = ${groupStats.f.toFixed(2)}, ${pText}, η² = ${groupStats.etaSq.toFixed(3)}. `;
      
      const groupMeans = groupStats.groups.map(g => `${g.name} (M = ${g.mean.toFixed(2)}, SD = ${Math.sqrt(g.variance).toFixed(2)})`).join(", ");
      text += `Descriptive statistics showed the following group means: ${groupMeans}. `;
      
      if (isSig && groupStats.pairwise.length > 0) {
        const sigPairs = groupStats.pairwise.filter(p => p.p < 0.05);
        if (sigPairs.length > 0) {
          text += `Post-hoc comparisons revealed significant mean differences between ${sigPairs.map(p => `${p.group1} and ${p.group2}`).join("; ")}. `;
        }
      }
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
        text += `This indicates that higher levels of ${xVar} are significantly associated with ${res.r > 0 ? "higher" : "lower"} values of ${yVar}. `;
        text += `The association is statistically significant at the α = .05 level.`;
      } else {
        text += `The correlation did not reach statistical significance at the α = .05 level.`;
      }
      return text;
    }
    return "";
  }, [xVar, yVar, xAsCategorical, groupStats, correlationResults, dataset]);

  const barChartData = useMemo(() => {
    if (!groupStats) return [];
    return groupStats.groups.map(g => ({
      name: g.name,
      mean: g.mean,
      sd: Math.sqrt(g.variance),
      n: g.n
    }));
  }, [groupStats]);

  if (!dataset) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Activity className="text-white w-7 h-7" />
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">EpiExplorer</h1>
            </div>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Professional preliminary data analysis for epidemiology research. Fast, statistical-first exploration of your datasets.
            </p>
          </div>
          <FileUpload onDataLoaded={handleDataLoaded} isLoading={loading} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center mb-3">
                <Search className="w-4 h-4 text-indigo-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Auto Variable Discovery</h4>
              <p className="text-xs text-slate-500 mt-1">Classification of numerical vs categorical variables with missing value detection.</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
                <Target className="w-4 h-4 text-emerald-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Statistical Significance</h4>
              <p className="text-xs text-slate-500 mt-1">Correlation matrices featuring P-values and industry-standard significance stars.</p>
            </div>
            <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center mb-3">
                <BarChart3 className="w-4 h-4 text-amber-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Excel & CSV Support</h4>
              <p className="text-xs text-slate-500 mt-1">Upload epidemiological datasets in various formats including .xlsx and .xls.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 sticky top-0 h-screen flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
          <Activity className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-slate-800 tracking-tight text-lg">EpiExplorer</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('univariate')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'univariate' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Distributions</span>
          </button>
          <button 
            onClick={() => setActiveTab('bivariate')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'bivariate' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Correlation</span>
          </button>
          <button 
            onClick={() => setActiveTab('focused')}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'focused' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <PieChart className="w-4 h-4" />
            <span>Focused Analysis</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase mb-2">
              <FileText className="w-3 h-3" />
              <span>Loaded File</span>
            </div>
            <p className="text-sm font-medium text-slate-700 truncate">{dataset.filename}</p>
            <button 
              onClick={reset}
              className="mt-2 w-full text-xs font-medium text-red-500 hover:text-red-600 transition-colors flex items-center justify-center py-1 border border-red-100 rounded bg-white"
            >
              Reset Session
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                {activeTab === 'overview' && 'Dataset Overview'}
                {activeTab === 'univariate' && 'Univariate Analysis'}
                {activeTab === 'bivariate' && 'Correlation Matrix'}
                {activeTab === 'focused' && 'Focused Analysis'}
              </h2>
              <p className="text-slate-500">Exploring {dataset.data.length} records across {dataset.variables.length} variables.</p>
            </div>
            <div className="flex space-x-2 text-xs">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-semibold uppercase">{dataset.numericalVariables.length} Numeric</span>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded font-semibold uppercase">{dataset.categoricalVariables.length} Categoric</span>
            </div>
          </div>

          {/* Tab Views */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dataset.variables.map(v => (
                <div key={v.name} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="max-w-[80%]">
                      <h4 className="font-bold text-slate-800 truncate" title={v.name}>{v.name}</h4>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${v.type === 'numerical' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {v.type}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-400 uppercase tracking-tighter">Missing Values</span>
                        <span className={`${v.stats.missing > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {v.stats.missing} ({((v.stats.missing / dataset.data.length) * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${((v.stats.count / dataset.data.length) * 100)}%` }}></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      {v.type === 'numerical' ? (
                        <>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Min - Max</p>
                            <p className="text-sm font-semibold text-slate-700">[{v.stats.min?.toFixed(1)} - {v.stats.max?.toFixed(1)}]</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Mean (SD)</p>
                            <p className="text-sm font-semibold text-slate-700">{v.stats.mean?.toFixed(2)} ({v.stats.std?.toFixed(2)})</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Unique</p>
                            <p className="text-sm font-semibold text-slate-700">{v.stats.unique} categories</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Top Group</p>
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {(() => {
                                const entries = Object.entries(v.stats.frequencies || {}) as [string, number][];
                                const top = entries.sort((a, b) => b[1] - a[1])[0];
                                return top ? top[0] : 'N/A';
                              })()}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'univariate' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {dataset.variables.map(v => (
                <div key={v.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800 text-lg">{v.name}</h3>
                    <div className="text-xs text-slate-400 flex items-center space-x-2">
                      <span>N={v.stats.count}</span>
                      <span>Missing={v.stats.missing} ({((v.stats.missing / dataset.data.length) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                  <DistributionPlot variable={v} />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'bivariate' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button 
                  onClick={() => handleDownload(heatmapRef, 'correlation-matrix')}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Matrix Image</span>
                </button>
              </div>
              <div ref={heatmapRef} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden download-capture">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-1">Correlation Heatmap</h3>
                    <p className="text-sm text-slate-500">Pearson r and P-value significance levels (* &lt; .05, ** &lt; .01, *** &lt; .001)</p>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-full text-xs text-slate-500 font-medium">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Positive</span>
                    <div className="w-3 h-3 bg-red-500 rounded-full ml-2"></div>
                    <span>Negative</span>
                  </div>
                </div>
                <CorrelationHeatmap 
                  results={correlationResults} 
                  variables={dataset.numericalVariables} 
                />
              </div>
            </div>
          )}

          {activeTab === 'focused' && (
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6 items-end mb-8">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Independent Variable (X)</label>
                    <div className="relative group">
                      <select 
                        value={xVar} 
                        onChange={(e) => setXVar(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none font-medium"
                      >
                        <optgroup label="Numerical">
                          {dataset.numericalVariables.map(v => <option key={v} value={v}>{v}</option>)}
                        </optgroup>
                        <optgroup label="Categorical">
                          {dataset.categoricalVariables.map(v => <option key={v} value={v}>{v}</option>)}
                        </optgroup>
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center space-y-3 mb-1">
                    <button 
                        onClick={() => setXAsCategorical(!xAsCategorical)}
                        title="Toggle Categorical/Group mode"
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-tight transition-all flex items-center space-x-2 border shadow-sm ${xAsCategorical ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400'}`}
                    >
                        <Layers className={`w-4 h-4 ${xAsCategorical ? 'animate-pulse' : ''}`} />
                        <span>Treat as Groups</span>
                    </button>
                    <div className="flex items-center space-x-1">
                      <ArrowRightLeft className="text-slate-200 w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dependent Variable (Y)</label>
                    <div className="relative">
                      <select 
                        value={yVar} 
                        onChange={(e) => setYVar(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none font-medium"
                      >
                        {dataset.numericalVariables.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDownload(scatterRef, `analysis-${xVar}-${yVar}`)}
                    className="flex items-center space-x-2 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors shadow-md text-sm font-medium h-[50px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Plot</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div ref={scatterRef} className="lg:col-span-2 bg-slate-50 rounded-2xl p-6 relative border border-slate-100 min-h-[500px] overflow-hidden download-capture">
                    {/* Top-Left Statistical Summary TextBox */}
                    <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-md min-w-[220px]">
                      {xAsCategorical ? (
                        groupStats && (
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2">
                              <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupStats.test}</p>
                            </div>
                            <div className="flex items-baseline space-x-2">
                              <span className="text-xl font-black text-slate-900">p = {groupStats.p < 0.001 ? '< 0.001' : groupStats.p.toFixed(3)}</span>
                              <span className="text-lg font-bold text-emerald-600">{getSignificanceStars(groupStats.p)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Effect size (η²)</span>
                                <span className="text-sm font-black text-emerald-600">{groupStats.etaSq.toFixed(3)}</span>
                            </div>
                          </div>
                        )
                      ) : (
                        (() => {
                          const res = correlationResults.find(r => r.x === xVar && r.y === yVar);
                          if (res) return (
                            <div className="space-y-1.5">
                              <div className="flex items-center space-x-2">
                                <Activity className="w-3.5 h-3.5 text-blue-500" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pearson Correlation</p>
                              </div>
                              <div className="flex items-baseline space-x-2">
                                <span className="text-xl font-black text-slate-900">r = {res.r.toFixed(3)}</span>
                                <span className="text-lg font-bold text-blue-600">{res.significance}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">P-value</span>
                                  <span className="text-sm font-black text-blue-600">{res.p < 0.001 ? '< 0.001' : res.p.toFixed(3)}</span>
                              </div>
                            </div>
                          );
                          return <p className="text-xs text-slate-400 font-medium italic">Select variables to see statistics</p>;
                        })()
                      )}
                    </div>

                    <div className="h-[460px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {xAsCategorical ? (
                          <BarChart data={barChartData} margin={{ top: 110, right: 30, left: 20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              label={{ value: xVar, position: 'bottom', offset: 25, fontSize: 13, fontWeight: 700, fill: '#475569' }} 
                            />
                            <YAxis 
                              label={{ value: `Mean ${yVar}`, angle: -90, position: 'insideLeft', offset: 0, fontSize: 13, fontWeight: 700, fill: '#475569' }} 
                            />
                            <Tooltip 
                                cursor={{fill: 'rgba(0,0,0,0.02)'}} 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            />
                            <Bar dataKey="mean" fill="#10b981" radius={[6, 6, 0, 0]} barSize={60}>
                              <ErrorBar dataKey="sd" width={4} strokeWidth={2} stroke="#047857" />
                              <LabelList 
                                dataKey="mean" 
                                position="top" 
                                offset={12} 
                                style={{ fontSize: '11px', fill: '#0f172a', fontWeight: '800' }} 
                                formatter={(val: number) => val.toFixed(2)}
                              />
                              {barChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fillOpacity={0.85} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <ScatterChart margin={{ top: 110, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis 
                              type="number" 
                              dataKey="x" 
                              name={xVar} 
                              label={{ value: xVar, position: 'bottom', offset: 25, fontSize: 13, fontWeight: 700, fill: '#475569' }} 
                            />
                            <YAxis 
                              type="number" 
                              dataKey="y" 
                              name={yVar} 
                              label={{ value: yVar, angle: -90, position: 'insideLeft', offset: 0, fontSize: 13, fontWeight: 700, fill: '#475569' }} 
                            />
                            <ZAxis type="number" range={[50, 50]} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Observations" data={focusedScatterData} fill="#3b82f6" fillOpacity={0.4} stroke="#2563eb" />
                          </ScatterChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center">
                        <FlaskConical className="w-4 h-4 mr-2 text-indigo-500" />
                        Statistical Evidence
                      </h4>
                      {xAsCategorical ? (
                        groupStats ? (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Global P-Value</p>
                                    <p className={`text-lg font-black ${groupStats.p < 0.05 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                        {groupStats.p < 0.0001 ? '< 0.0001' : groupStats.p.toFixed(4)}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Effect size (η²)</p>
                                    <p className="text-lg font-black text-indigo-600">{groupStats.etaSq.toFixed(3)}</p>
                                </div>
                            </div>

                            {groupStats.pairwise.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center">
                                        <ArrowRightLeft className="w-3 h-3 mr-1" />
                                        Subgroup Comparisons (T-Tests)
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {groupStats.pairwise.map((p, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 group transition-all hover:border-blue-200">
                                                <div className="flex items-center text-[11px] font-semibold text-slate-600 truncate max-w-[140px]">
                                                    <span className="truncate">{p.group1}</span>
                                                    <ArrowRight className="w-3 h-3 mx-1 flex-shrink-0" />
                                                    <span className="truncate">{p.group2}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <span className={`text-[11px] font-black ${p.p < 0.05 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        p={p.p.toFixed(3)}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-emerald-500">{p.sig}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-50">
                                <p className="text-xs text-slate-500 leading-relaxed italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    {groupStats.p < 0.05 
                                        ? `The grouping factor ${xVar} significantly explains variation in ${yVar}. Differences between group means are likely non-random.` 
                                        : `Differences between categories of ${xVar} are not statistically significant at α=0.05.`}
                                </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Layers className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-xs text-slate-400 font-medium">Toggle "Treat as Groups" to compare categorical means.</p>
                          </div>
                        )
                      ) : (
                        (() => {
                          const res = correlationResults.find(r => r.x === xVar && r.y === yVar);
                          if (!res) return (
                            <div className="text-center py-8">
                              <PieChart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                              <p className="text-xs text-slate-400 font-medium">Choose two numerical variables to analyze correlation.</p>
                            </div>
                          );
                          return (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Pearson Coefficient (r)</span>
                                            <span className="text-sm font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{res.significance || 'ns'}</span>
                                        </div>
                                        <p className="text-3xl font-black text-slate-900">{res.r.toFixed(4)}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Confidence P-value</p>
                                        <p className={`text-xl font-black ${res.p < 0.05 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                            {res.p < 0.0001 ? '< 0.0001' : res.p.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                    <h5 className="text-[10px] font-bold text-blue-800 uppercase mb-2 flex items-center">
                                        <Info className="w-3 h-3 mr-1" />
                                        Interpretation
                                    </h5>
                                    <p className="text-xs text-blue-800/80 leading-relaxed font-medium">
                                        {Math.abs(res.r) > 0.6 
                                            ? 'Strong linear association detected.' 
                                            : Math.abs(res.r) > 0.25 
                                                ? 'Moderate linear association present.' 
                                                : 'Weak linear association observed.'}
                                        {res.r > 0 ? ' Positive trend: values rise together.' : ' Inverse trend: one rises as the other falls.'}
                                    </p>
                                </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                {/* Academic Results Summary Section */}
                {academicSummary && (
                  <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-600">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Academic Results Draft</h4>
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(academicSummary);
                          alert("Summary copied to clipboard!");
                        }}
                        className="flex items-center space-x-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Copy Summary</span>
                      </button>
                    </div>
                    <div className="p-8 relative">
                      <Quote className="absolute top-4 left-4 w-12 h-12 text-slate-100 -z-0 pointer-events-none" />
                      <div className="relative z-10">
                        <p className="text-slate-700 leading-relaxed text-sm font-serif italic selection:bg-blue-100">
                          {academicSummary}
                        </p>
                        <p className="mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center space-x-2 border-t border-slate-50 pt-4">
                          <Info className="w-3 h-3" />
                          <span>Generated result draft for academic reporting (APA style approximation)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default App;
