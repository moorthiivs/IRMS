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
