
export type VariableType = 'numerical' | 'categorical' | 'unknown';

export interface DataVariable {
  name: string;
  type: VariableType;
  values: any[];
  stats: VariableStats;
}

export interface VariableStats {
  count: number;
  missing: number;
  unique: number;
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  frequencies?: Record<string, number>;
}

export interface CorrelationResult {
  x: string;
  y: string;
  r: number;
  p: number;
  n: number;
  significance: string;
}

export interface Dataset {
  filename: string;
  data: any[];
  variables: DataVariable[];
  numericalVariables: string[];
  categoricalVariables: string[];
}
