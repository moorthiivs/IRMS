export interface SpcResult {
  mean: number;
  sigma: number;
  n: number;
  min: number;
  max: number;
  cp: number | null;
  cpk: number | null;
  ucl: number;
  lcl: number;
  cl: number;
}

/**
 * Calculates SPC statistics for an array of numerical values
 */
export function calculateSpcStatistics(
  data: number[],
  usl: number | null,
  lsl: number | null,
  calculationMethod: 'STATISTICAL' | 'FIXED' = 'STATISTICAL',
  customSigma?: number | null
): SpcResult {
  const n = data.length;
  
  if (n === 0) {
    return {
      mean: 0, sigma: 0, n: 0, min: 0, max: 0,
      cp: null, cpk: null, ucl: 0, lcl: 0, cl: 0
    };
  }

  // Basic Stats
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const min = Math.min(...data);
  const max = Math.max(...data);

  // Standard Deviation
  let sigma = 0;
  if (customSigma !== undefined && customSigma !== null && customSigma >= 0) {
    sigma = customSigma;
  } else if (n > 1) {
    const sumSqDiff = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    sigma = Math.sqrt(sumSqDiff / (n - 1)); // Sample standard deviation
  }

  // Cp & Cpk
  let cp: number | null = null;
  let cpk: number | null = null;
  
  if (usl !== null && lsl !== null && sigma > 0) {
    cp = (usl - lsl) / (6 * sigma);
    
    const cpkUpper = (usl - mean) / (3 * sigma);
    const cpkLower = (mean - lsl) / (3 * sigma);
    cpk = Math.min(cpkUpper, cpkLower);
  } else if (usl !== null && sigma > 0) {
    cpk = (usl - mean) / (3 * sigma);
  } else if (lsl !== null && sigma > 0) {
    cpk = (mean - lsl) / (3 * sigma);
  }

  // Control Limits
  let ucl = 0;
  let lcl = 0;
  const cl = mean;

  if (calculationMethod === 'STATISTICAL') {
    // Standard 3-sigma limits based on data
    ucl = mean + (3 * sigma);
    lcl = mean - (3 * sigma);
  } else if (calculationMethod === 'FIXED' && usl !== null && lsl !== null) {
    // Common industry practice for fixed tolerance (70% of tolerance band)
    const nominal = (usl + lsl) / 2;
    const tolerance = usl - lsl;
    ucl = nominal + (tolerance * 0.35); // + 35%
    lcl = nominal - (tolerance * 0.35); // - 35%
  } else {
    // Fallback if missing limits for FIXED
    ucl = mean + (3 * sigma);
    lcl = mean - (3 * sigma);
  }

  return {
    mean,
    sigma,
    n,
    min,
    max,
    cp,
    cpk,
    ucl,
    lcl,
    cl
  };
}

export interface SubgroupData {
  id: string | number; // Subgroup ID or Date
  readings: any[]; // Original readings in this subgroup
  xBar: number;
  r: number;
  size: number;
}

export interface XBarRResult {
  subgroups: SubgroupData[];
  xDoubleBar: number; // Process Mean
  rBar: number;       // Avg Range
  sigma: number;      // Process Sigma (estimated: rBar / d2)
  cp: number | null;
  cpk: number | null;
  xBarUcl: number;
  xBarLcl: number;
  rUcl: number;
  rLcl: number;
}

const SPC_CONSTANTS: Record<number, { A2: number; d2: number; D3: number; D4: number }> = {
  2: { A2: 1.880, d2: 1.128, D3: 0, D4: 3.267 },
  3: { A2: 1.023, d2: 1.693, D3: 0, D4: 2.574 },
  4: { A2: 0.729, d2: 2.059, D3: 0, D4: 2.282 },
  5: { A2: 0.577, d2: 2.326, D3: 0, D4: 2.114 },
  6: { A2: 0.483, d2: 2.534, D3: 0, D4: 2.004 },
  7: { A2: 0.419, d2: 2.704, D3: 0.076, D4: 1.924 },
  8: { A2: 0.373, d2: 2.847, D3: 0.136, D4: 1.864 },
  9: { A2: 0.337, d2: 2.970, D3: 0.184, D4: 1.816 },
  10: { A2: 0.308, d2: 3.078, D3: 0.223, D4: 1.777 },
};

/**
 * Calculates X-bar and R chart statistics
 * @param readings Array of raw readings (must contain 'value' property)
 * @param strategy 'FIXED' or 'SHIFT'
 * @param sizeOrKey Fixed subgroup size (e.g. 5) or the object key for grouping (e.g. 'shiftName')
 */
export function calculateXBarRChartStats(
  readings: any[],
  strategy: 'FIXED' | 'SHIFT',
  sizeOrKey: number | string,
  usl: number | null,
  lsl: number | null
): XBarRResult {
  const subgroups: SubgroupData[] = [];
  
  if (!readings || readings.length === 0) {
    return { subgroups: [], xDoubleBar: 0, rBar: 0, sigma: 0, cp: null, cpk: null, xBarUcl: 0, xBarLcl: 0, rUcl: 0, rLcl: 0 };
  }

  // Grouping logic
  if (strategy === 'FIXED') {
    const size = typeof sizeOrKey === 'number' ? sizeOrKey : 5;
    for (let i = 0; i < readings.length; i += size) {
      const chunk = readings.slice(i, i + size);
      if (chunk.length > 1) { // R chart needs at least 2 items per subgroup
        subgroups.push(createSubgroupData(chunk, (i / size) + 1));
      }
    }
  } else if (strategy === 'SHIFT') {
    const key = typeof sizeOrKey === 'string' ? sizeOrKey : 'shiftName';
    const groups: Record<string, any[]> = {};
    
    // Group by key (e.g., shiftName, or date+shift)
    readings.forEach(r => {
      // Create a unique key combining date and shift
      const groupKey = `${r.date}_${r[key]}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(r);
    });

    Object.keys(groups).forEach((gKey, idx) => {
      if (groups[gKey].length > 1) {
        subgroups.push(createSubgroupData(groups[gKey], idx + 1));
      }
    });
  }

  if (subgroups.length === 0) {
    return { subgroups: [], xDoubleBar: 0, rBar: 0, sigma: 0, cp: null, cpk: null, xBarUcl: 0, xBarLcl: 0, rUcl: 0, rLcl: 0 };
  }

  // Calculate Averages
  const xDoubleBar = subgroups.reduce((sum, sg) => sum + sg.xBar, 0) / subgroups.length;
  const rBar = subgroups.reduce((sum, sg) => sum + sg.r, 0) / subgroups.length;

  // Average subgroup size to find constants
  const avgSize = Math.round(subgroups.reduce((sum, sg) => sum + sg.size, 0) / subgroups.length);
  // Cap at 10 for standard constants, though S-chart is better for >10
  const constantsSize = Math.min(Math.max(avgSize, 2), 10);
  const constants = SPC_CONSTANTS[constantsSize];

  if (!constants) {
      // Fallback
      return { subgroups, xDoubleBar, rBar, sigma: 0, cp: null, cpk: null, xBarUcl: 0, xBarLcl: 0, rUcl: 0, rLcl: 0 };
  }

  const xBarUcl = xDoubleBar + (constants.A2 * rBar);
  const xBarLcl = xDoubleBar - (constants.A2 * rBar);
  const rUcl = constants.D4 * rBar;
  const rLcl = constants.D3 * rBar;

  const sigma = rBar / constants.d2;
  
  // Capability
  let cp: number | null = null;
  let cpk: number | null = null;
  
  if (usl !== null && lsl !== null && sigma > 0) {
    cp = (usl - lsl) / (6 * sigma);
    const cpkUpper = (usl - xDoubleBar) / (3 * sigma);
    const cpkLower = (xDoubleBar - lsl) / (3 * sigma);
    cpk = Math.min(cpkUpper, cpkLower);
  } else if (usl !== null && sigma > 0) {
    cpk = (usl - xDoubleBar) / (3 * sigma);
  } else if (lsl !== null && sigma > 0) {
    cpk = (xDoubleBar - lsl) / (3 * sigma);
  }

  return {
    subgroups,
    xDoubleBar,
    rBar,
    sigma,
    cp,
    cpk,
    xBarUcl,
    xBarLcl,
    rUcl,
    rLcl
  };
}

function createSubgroupData(chunk: any[], id: string | number): SubgroupData {
  const values = chunk.map(c => c.value).filter(v => typeof v === 'number' && !isNaN(v));
  if (values.length === 0) return { id, readings: chunk, xBar: 0, r: 0, size: 0 };
  
  const sum = values.reduce((a, b) => a + b, 0);
  const xBar = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const r = max - min;
  
  return { id, readings: chunk, xBar, r, size: values.length };
}
