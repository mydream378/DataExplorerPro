
import { CorrelationResult, VariableType } from '../types';

/**
 * Calculates Pearson Correlation Coefficient
 */
export const calculatePearson = (x: number[], y: number[]): number => {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
};

/**
 * Calculates P-value for a t-statistic using approximation
 */
const getPFromT = (t: number, df: number): number => {
  if (df <= 0) return 1.0;
  const z = Math.abs(t);
  // Using a more robust approximation for the normal distribution for p-values
  const t_abs = Math.abs(t);
  const k = 1 / (1 + 0.2316419 * t_abs);
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const poly = ((((a5 * k + a4) * k + a3) * k + a2) * k + a1) * k;
  const normalCDF = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * t_abs * t_abs) * poly;
  
  // Correction factor for low DF (t-dist vs normal-dist)
  let p = 2 * (1 - normalCDF);
  if (df < 30) {
    p = p * (1 + (p * p + 1) / (4 * df)); // Very rough correction
  }
  return Math.min(Math.max(p, 0), 1);
};

export const calculatePValue = (r: number, n: number): number => {
  if (n <= 2) return 1.0;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r));
  return getPFromT(t, n - 2);
};

/**
 * Perform One-way ANOVA or T-test logic
 */
export interface PairwiseComparison {
  group1: string;
  group2: string;
  p: number;
  sig: string;
}

export const calculateGroupStats = (groups: Record<string, number[]>) => {
  const groupNames = Object.keys(groups);
  const k = groupNames.length;
  if (k < 2) return null;

  const allValues: number[] = [];
  const groupData = groupNames.map(name => {
    const vals = groups[name];
    allValues.push(...vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const ssq = vals.reduce((a, b) => a + (b - mean) ** 2, 0);
    const variance = ssq / (vals.length - 1 || 1);
    return { name, n: vals.length, mean, ssq, variance };
  });

  const grandMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  const nTotal = allValues.length;

  // Sum of Squares Between
  const ssb = groupData.reduce((acc, g) => acc + g.n * (g.mean - grandMean) ** 2, 0);
  // Sum of Squares Within
  const ssw = groupData.reduce((acc, g) => acc + g.ssq, 0);
  
  const dfB = k - 1;
  const dfW = nTotal - k;
  
  if (dfW <= 0) return null;

  const msb = ssb / dfB;
  const msw = ssw / dfW;
  const f = msb / msw;

  // Approximate p-value for the F statistic
  const pGlobal = getPFromT(Math.sqrt(f), dfW); 
  const etaSq = ssb / (ssb + ssw);

  // Pairwise Comparisons (Post-hoc indicators)
  const pairwise: PairwiseComparison[] = [];
  if (k >= 2) {
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const g1 = groupData[i];
        const g2 = groupData[j];
        // Pooled variance t-test
        const pooledVar = ((g1.n - 1) * g1.variance + (g2.n - 1) * g2.variance) / (g1.n + g2.n - 2);
        const t = Math.abs(g1.mean - g2.mean) / Math.sqrt(pooledVar * (1 / g1.n + 1 / g2.n));
        const pPair = getPFromT(t, g1.n + g2.n - 2);
        pairwise.push({
          group1: g1.name,
          group2: g2.name,
          p: pPair,
          sig: getSignificanceStars(pPair)
        });
      }
    }
  }

  return {
    test: k === 2 ? 'Independent T-test' : 'One-way ANOVA',
    f,
    p: pGlobal,
    etaSq,
    groups: groupData,
    dfB,
    dfW,
    pairwise
  };
};

export const getSignificanceStars = (p: number): string => {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return '';
};

export const calculateSummaryStats = (values: any[], type: VariableType) => {
  const filtered = values.filter(v => v !== null && v !== undefined && v !== '');
  const n = filtered.length;
  const missing = values.length - n;
  const unique = new Set(filtered).size;

  if (type === 'categorical' || type === 'unknown') {
    const freqs: Record<string, number> = {};
    filtered.forEach(v => {
      const key = String(v);
      freqs[key] = (freqs[key] || 0) + 1;
    });
    return { count: n, missing, unique, frequencies: freqs };
  }

  const nums = filtered.map(Number).filter(v => !isNaN(v));
  if (nums.length === 0) return { count: 0, missing: values.length, unique: 0 };

  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / nums.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 
    : sorted[Math.floor(sorted.length / 2)];
  
  const sqDiffs = nums.map(v => Math.pow(v - mean, 2));
  const std = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / nums.length);

  return {
    count: n,
    missing,
    unique,
    mean,
    median,
    std,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
};

export const getCorrelationMatrix = (data: any[], vars: string[]): CorrelationResult[] => {
  const results: CorrelationResult[] = [];
  for (let i = 0; i < vars.length; i++) {
    for (let j = 0; j < vars.length; j++) {
      const xVar = vars[i];
      const yVar = vars[j];
      
      const pairs = data
        .map(row => ({ x: Number(row[xVar]), y: Number(row[yVar]) }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y));
      
      const xVals = pairs.map(p => p.x);
      const yVals = pairs.map(p => p.y);
      const r = calculatePearson(xVals, yVals);
      const p = calculatePValue(r, pairs.length);
      
      results.push({
        x: xVar,
        y: yVar,
        r,
        p,
        n: pairs.length,
        significance: getSignificanceStars(p)
      });
    }
  }
  return results;
};
