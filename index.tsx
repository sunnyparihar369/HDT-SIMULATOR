import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, CheckCircle, Settings, ArrowRight, BarChart3, FlaskConical, ClipboardCheck, XCircle, Play, History, Save, Clock, Moon, Sun } from 'lucide-react';

// --- HDT Logic Translation (Python -> TypeScript) ---

// Types
type Concentrations = {
  [key: string]: number;
};

type SimulationResult = {
  aqOut: Concentrations;
  orgOut: Concentrations;
};

type OptimizationResult = {
  new_pH_setpoint: number;
  action: string;
  predicted_efficiency: number;
};

type ComplianceResult = {
  total_conc_gl: number;
  is_compliant: boolean;
  finding: string;
};

type HistoryEntry = {
  id: number;
  timestamp: string;
  inputs: {
    aqIn: Concentrations;
    phaseRatio: number;
    currentPH: number;
    targetPH: number;
  };
  outputs: {
    th_u_total: number;
    is_compliant: boolean;
    efficiency: number;
  };
};

// Module 1: Thermodynamic and Kinetic Core Engine
const simulate_sx_stage = (
  aq_in_conc: Concentrations,
  org_in_conc: Concentrations,
  phase_ratio: number,
  D_values: Concentrations
): SimulationResult => {
  const aqOut: Concentrations = {};
  const orgOut: Concentrations = {};

  // Explicitly define elements to ensure Th and U are included in calculations
  // regardless of whether they exist in the input object keys.
  const targetElements = ['Nd', 'Fe', 'Th', 'U'];
  
  // Sanitize Phase Ratio (Physical constraint: Must be > 0)
  // Fallback to 1.0 if NaN (e.g. user clears input)
  const rVal = Number.isNaN(phase_ratio) ? 1.0 : phase_ratio;
  const safeR = Math.max(0.0001, rVal);

  targetElements.forEach((el) => {
    // Mass Balance:
    // Cin_aq + (O/A)*Cin_org = Cout_aq + (O/A)*Cout_org
    // Equilibrium: Cout_org = D * Cout_aq
    // Combine: Cout_aq = (Cin_aq + (O/A)*Cin_org) / (1 + (O/A)*D)

    // Robustness: Clamp negative concentrations to 0. Treat NaN as 0.
    const Cin_aq = Math.max(0, aq_in_conc[el] || 0);
    const Cin_org = Math.max(0, org_in_conc[el] || 0);
    const D = Math.max(0, D_values[el] || 0);

    const denominator = 1 + safeR * D;
    
    // Denominator is always >= 1 since R and D are non-negative
    const Cout_aq = (Cin_aq + safeR * Cin_org) / denominator;
    const Cout_org = D * Cout_aq;

    // Floating point precision handling
    aqOut[el] = parseFloat(Cout_aq.toFixed(4));
    orgOut[el] = parseFloat(Cout_org.toFixed(4));
  });

  return { aqOut, orgOut };
};

// Module 2: Scientific AI/ML Optimizer
const prescriptive_setpoint_optimizer = (
  current_pH: number,
  target_optimal_pH: number = 1.8,
  deterministic: boolean = false // Added for testing purposes to remove noise
): OptimizationResult => {
  // Sanitize inputs
  const cPH = Number.isNaN(current_pH) ? 0 : current_pH;
  const tPH = Number.isNaN(target_optimal_pH) ? 1.8 : target_optimal_pH;

  // Simulated Efficiency: E = 0.8 - 0.2(pH - 1.8)^2 + noise
  const noise = deterministic ? 0 : (Math.random() - 0.5) * 0.05; // Random noise +/- 0.025
  const efficiency = 0.8 - 0.2 * Math.pow(cPH - tPH, 2) + noise;

  // Simple Gradient/Logic: Move 50% towards target
  const delta = tPH - cPH;
  const correction_step = delta * 0.5;
  
  // Floating point precision fix for setpoint
  const new_pH_setpoint = parseFloat((cPH + correction_step).toFixed(2));

  let action = 'Maintain pH';
  if (correction_step > 0.01) action = 'Increase Acid/Base Flow (Raise pH)';
  else if (correction_step < -0.01) action = 'Adjust Acid/Base Flow (Lower pH)';

  return {
    new_pH_setpoint,
    action,
    predicted_efficiency: Math.max(0, Math.min(1, efficiency)), // Clamp 0-1
  };
};

// Module 3: Th/U Safety and Regulatory Compliance Simulator
const check_th_u_compliance = (
  th_conc: number,
  u_conc: number,
  limit: number = 0.1
): ComplianceResult => {
  // Handle potentially undefined or null inputs gracefully
  // Robustness: Clamp negative values to 0 to prevent false compliance (e.g. -5 < 0.1)
  const safeTh = Math.max(0, th_conc || 0);
  const safeU = Math.max(0, u_conc || 0);
  const safeLimit = Number.isNaN(limit) ? 0.1 : limit;
  
  const total = safeTh + safeU;
  // Strict check: strictly less than limit to pass
  const is_compliant = total < safeLimit;

  return {
    total_conc_gl: parseFloat(total.toFixed(4)),
    is_compliant,
    finding: is_compliant
      ? 'Meets NCMM Th/U safety requirements.'
      : 'EXCEEDS Regulatory Limit. Adjust flowsheet.',
  };
};

// --- Unit Test Engine ---

type TestResult = {
    module: string;
    name: string;
    passed: boolean;
    expected?: string;
    actual?: string;
};

const runAllTests = (): TestResult[] => {
    const results: TestResult[] = [];

    // Helper to add result
    const assert = (module: string, name: string, condition: boolean, expected: any, actual: any) => {
        results.push({
            module,
            name,
            passed: condition,
            expected: JSON.stringify(expected),
            actual: JSON.stringify(actual)
        });
    };

    // --- Module 1 Tests: SX Simulation ---
    
    // 1.1 Basic Calculation
    // Input: 10 g/L, D=1, O/A=1. 
    // Eq: AqOut = 10 / (1 + 1*1) = 5. OrgOut = 5*1 = 5.
    const res1 = simulate_sx_stage({ Nd: 10 }, {}, 1, { Nd: 1 });
    assert('Thermodynamic Core', 'Basic Separation (D=1, R=1)', 
        res1.aqOut.Nd === 5 && res1.orgOut.Nd === 5,
        'Aq:5, Org:5', 
        `Aq:${res1.aqOut.Nd}, Org:${res1.orgOut.Nd}`
    );

    // 1.2 High Extraction
    // Input: 10 g/L, D=9, O/A=1.
    // Eq: AqOut = 10 / (1 + 9) = 1. OrgOut = 9*1 = 9.
    const res2 = simulate_sx_stage({ Nd: 10 }, {}, 1, { Nd: 9 });
    assert('Thermodynamic Core', 'High Extraction (D=9)',
        res2.aqOut.Nd === 1 && res2.orgOut.Nd === 9,
        'Aq:1, Org:9',
        `Aq:${res2.aqOut.Nd}, Org:${res2.orgOut.Nd}`
    );

    // 1.3 Mass Balance Check
    // Input: 100 total mass units. D=2.5, R=2.
    // In = 100. Out = AqOut + R*OrgOut.
    const aqInMass = 100;
    const R = 2;
    const res3 = simulate_sx_stage({ Nd: aqInMass }, {}, R, { Nd: 2.5 });
    const massOut = res3.aqOut.Nd + (R * res3.orgOut.Nd);
    assert('Thermodynamic Core', 'Mass Balance Conservation',
        Math.abs(massOut - aqInMass) < 0.1, // Floating point tolerance
        `Total Mass ~${aqInMass}`,
        `Total Mass ${massOut}`
    );

    // 1.4 Missing Keys Handling
    // Input should treat missing Th as 0
    const res4 = simulate_sx_stage({ Nd: 5 }, {}, 1, { Nd: 1 });
    assert('Thermodynamic Core', 'Missing Input Key Handling',
        res4.aqOut.Th === 0,
        'Th AqOut: 0',
        `Th AqOut: ${res4.aqOut.Th}`
    );
    
    // 1.5 Robustness Negative Input
    // Input: -10. Should be clamped to 0.
    const res5 = simulate_sx_stage({ Nd: -10 }, {}, 1, { Nd: 1 });
    assert('Thermodynamic Core', 'Negative Input Clamping',
        res5.aqOut.Nd === 0,
        'AqOut: 0',
        `AqOut: ${res5.aqOut.Nd}`
    );


    // --- Module 2 Tests: AI Optimizer ---

    // 2.1 Raise pH Logic
    // Current=1.0, Target=2.0. Delta=1.0. Step=0.5. New=1.5.
    const opt1 = prescriptive_setpoint_optimizer(1.0, 2.0, true);
    assert('AI Optimizer', 'Setpoint Logic (Raise pH)',
        opt1.new_pH_setpoint === 1.5,
        'Setpoint: 1.5',
        `Setpoint: ${opt1.new_pH_setpoint}`
    );
    assert('AI Optimizer', 'Action Text (Raise)',
        opt1.action.includes('Increase'),
        'Contains "Increase"',
        opt1.action
    );

    // 2.2 Lower pH Logic
    // Current=2.0, Target=1.0. Delta=-1.0. Step=-0.5. New=1.5.
    const opt2 = prescriptive_setpoint_optimizer(2.0, 1.0, true);
    assert('AI Optimizer', 'Setpoint Logic (Lower pH)',
        opt2.new_pH_setpoint === 1.5,
        'Setpoint: 1.5',
        `Setpoint: ${opt2.new_pH_setpoint}`
    );
    assert('AI Optimizer', 'Action Text (Lower)',
        opt2.action.includes('Lower') || opt2.action.includes('Adjust'),
        'Contains "Lower/Adjust"',
        opt2.action
    );

    // 2.3 Efficiency Bounds
    // Test random noise doesn't break bounds 0-1 (running multiple times)
    let inBounds = true;
    for(let i=0; i<50; i++) {
        const res = prescriptive_setpoint_optimizer(1.8, 1.8, false); // with noise
        if (res.predicted_efficiency < 0 || res.predicted_efficiency > 1) inBounds = false;
    }
    assert('AI Optimizer', 'Efficiency Bounds (0-1)',
        inBounds,
        'All efficient values between 0 and 1',
        inBounds ? 'Pass' : 'Fail'
    );


    // --- Module 3 Tests: Compliance ---

    // 3.1 Compliant Case
    const comp1 = check_th_u_compliance(0.04, 0.05, 0.1);
    assert('Compliance Simulator', 'Compliant Case (< Limit)',
        comp1.is_compliant === true,
        'Compliant: true',
        `Compliant: ${comp1.is_compliant}`
    );

    // 3.2 Non-Compliant Case
    const comp2 = check_th_u_compliance(0.06, 0.05, 0.1);
    assert('Compliance Simulator', 'Non-Compliant Case (> Limit)',
        comp2.is_compliant === false,
        'Compliant: false',
        `Compliant: ${comp2.is_compliant}`
    );

    // 3.3 Boundary Case (Equal to limit)
    // If limit is 0.1 and total is 0.1, it should technically be non-compliant if strictly < check.
    const comp3 = check_th_u_compliance(0.05, 0.05, 0.1);
    assert('Compliance Simulator', 'Boundary Case (Equal to Limit)',
        comp3.is_compliant === false,
        'Compliant: false (Strict <)',
        `Compliant: ${comp3.is_compliant}`
    );

    // 3.4 Floating Point Summation
    // 0.1 + 0.2 = 0.300000000004 standard JS math.
    const comp4 = check_th_u_compliance(0.1, 0.2, 0.5);
    assert('Compliance Simulator', 'Floating Point Precision Display',
        comp4.total_conc_gl === 0.3,
        'Total: 0.3',
        `Total: ${comp4.total_conc_gl}`
    );
    
    // 3.5 Negative input safety
    const comp5 = check_th_u_compliance(-5, 0.2, 0.5);
    assert('Compliance Simulator', 'Negative Input Safety',
        comp5.total_conc_gl === 0.2,
        'Total: 0.2 (ignores -5)',
        `Total: ${comp5.total_conc_gl}`
    );

    return results;
};


// --- React Components ---

const Card = ({ title, icon, children, className = "" }: any) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}>
    <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
      {icon}
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: string;
  type?: string;
  className?: string;
}

const InputField = ({ label, value, onChange, min, max, step = "0.1", type = "number", className = "" }: InputFieldProps) => {
  const isNaNValue = Number.isNaN(value);
  const isBelowMin = min !== undefined && !isNaNValue && value < min;
  const isAboveMax = max !== undefined && !isNaNValue && value > max;
  const isError = isBelowMin || isAboveMax;

  let errorMsg = "";
  if (isBelowMin) errorMsg = `Min: ${min}`;
  else if (isAboveMax) errorMsg = `Max: ${max}`;

  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        // Handle NaN by showing empty string to allow clearing input
        value={isNaNValue ? '' : value}
        onChange={(e) => {
            const val = parseFloat(e.target.value);
            // Allow NaN (empty) or any number to propagate to state
            onChange(val); 
        }}
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all font-mono
            ${isError 
                ? 'border-red-300 dark:border-red-700 focus:ring-red-200 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' 
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 focus:ring-blue-500 text-slate-700 dark:text-slate-200'}`}
      />
      {isError && (
          <div className="text-[10px] text-red-500 dark:text-red-400 mt-1 font-medium flex items-center gap-1">
             <AlertTriangle size={10} /> {errorMsg}
          </div>
      )}
    </div>
  );
};

// Chart Component
const EfficiencyChart = ({ currentPH, recommendedPH, targetOptimalPH, isDarkMode }: { currentPH: number, recommendedPH: number, targetOptimalPH: number, isDarkMode: boolean }) => {
  const width = 600;
  const height = 280; // Increased height
  const margin = { top: 40, right: 40, bottom: 40, left: 50 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;

  // Colors based on theme
  const colors = isDarkMode ? {
    bg: '#1e293b', // slate-800
    grid: '#334155', // slate-700
    text: '#94a3b8', // slate-400
    pointFill: '#0f172a', // slate-900
    pointStroke: '#cbd5e1', // slate-300
    rectFill: '#0f172a', // slate-900
    rectStroke: '#475569', // slate-600
    rectText: '#e2e8f0', // slate-200
  } : {
    bg: 'white',
    grid: '#e2e8f0',
    text: '#94a3b8',
    pointFill: 'white',
    pointStroke: '#64748b',
    rectFill: 'white',
    rectStroke: '#cbd5e1',
    rectText: '#64748b',
  };

  // Ranges
  const minPH = 0.0;
  const maxPH = 3.5;
  const minEff = 0.0;
  const maxEff = 1.0;

  const getX = (ph: number) => margin.left + ((ph - minPH) / (maxPH - minPH)) * graphWidth;
  const getY = (eff: number) => margin.top + graphHeight - ((eff - minEff) / (maxEff - minEff)) * graphHeight;

  // Sanitize inputs for visualization to prevent crashing on NaN
  const cPH = Number.isNaN(currentPH) ? 0 : currentPH;
  const rPH = Number.isNaN(recommendedPH) ? 0 : recommendedPH;
  const tPH = Number.isNaN(targetOptimalPH) ? 1.8 : targetOptimalPH;

  // Generate Curve
  const pathData = [];
  const step = 0.05;
  for (let ph = minPH; ph <= maxPH; ph += step) {
     // Theoretical model: E = 0.8 - 0.2(pH - 1.8)^2
     const eff = 0.8 - 0.2 * Math.pow(ph - tPH, 2);
     const clampedEff = Math.max(0, eff);
     pathData.push(`${getX(ph)},${getY(clampedEff)}`);
  }
  const pathString = `M ${pathData.join(' L ')}`;

  // Points
  const currentEff = Math.max(0, 0.8 - 0.2 * Math.pow(cPH - tPH, 2));
  const recEff = Math.max(0, 0.8 - 0.2 * Math.pow(rPH - tPH, 2));

  // Clamp for visualization
  const clampPH = (p: number) => Math.max(minPH, Math.min(maxPH, p));
  
  const cxCur = getX(clampPH(cPH));
  const cyCur = getY(currentEff);
  const cxRec = getX(clampPH(rPH));
  const cyRec = getY(recEff);
  const cxTarget = getX(clampPH(tPH));

  return (
    <div className="w-full mt-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
             <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Nd Extraction Efficiency Model
            </div>
            <div className="flex gap-4 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-slate-500 bg-white dark:bg-slate-700"></div> Current</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Recommended</div>
                <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-emerald-400"></div> Target</div>
            </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block bg-slate-50/20 dark:bg-slate-900/20">
            <defs>
                <linearGradient id="curveGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                </linearGradient>
            </defs>

            {/* Background Grid */}
            <rect x={margin.left} y={margin.top} width={graphWidth} height={graphHeight} fill={colors.bg} />
            
            {/* Y Axis */}
            {[0, 0.25, 0.5, 0.75, 1.0].map(val => (
                <g key={val}>
                    <line x1={margin.left} y1={getY(val)} x2={margin.left + graphWidth} y2={getY(val)} stroke={colors.grid} strokeWidth="1" />
                    <text x={margin.left - 8} y={getY(val)} fontSize="10" fill={colors.text} alignmentBaseline="middle" textAnchor="end">{(val * 100).toFixed(0)}%</text>
                </g>
            ))}

            {/* X Axis */}
            {Array.from({length: 8}, (_, i) => i * 0.5).map(ph => (
                 <g key={ph}>
                    <line x1={getX(ph)} y1={margin.top} x2={getX(ph)} y2={margin.top + graphHeight} stroke={colors.grid} strokeWidth="1" />
                    <text x={getX(ph)} y={height - margin.bottom + 15} fontSize="10" fill={colors.text} textAnchor="middle">{ph.toFixed(1)}</text>
                 </g>
            ))}
            <text x={width/2} y={height - 15} fontSize="10" fill={colors.text} textAnchor="middle" fontWeight="bold">pH Level</text>

            {/* Optimal Target Line */}
            <line x1={cxTarget} y1={margin.top} x2={cxTarget} y2={margin.top + graphHeight} stroke="#34d399" strokeWidth="2" strokeDasharray="5 5" opacity="0.6" />
            <text x={cxTarget} y={margin.top - 10} fontSize="10" fill="#10b981" textAnchor="middle" fontWeight="bold">Target {tPH}</text>

            {/* Curve with Area */}
            <path d={`${pathString} L ${getX(maxPH)} ${getY(0)} L ${getX(minPH)} ${getY(0)} Z`} fill="url(#curveGradient)" />
            <path d={pathString} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />

            {/* Movement Arrow */}
             {Math.abs(cxRec - cxCur) > 5 && (
                 <g opacity="0.5">
                     <line x1={cxCur} y1={cyCur} x2={cxRec} y2={cyRec} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
                 </g>
            )}

            {/* Current Point */}
            <circle cx={cxCur} cy={cyCur} r="5" fill={colors.pointFill} stroke={colors.pointStroke} strokeWidth="2" />
            <g transform={`translate(${cxCur}, ${cyCur - 25})`}>
                 <rect x="-22" y="-10" width="44" height="20" rx="4" fill={colors.rectFill} stroke={colors.rectStroke} strokeWidth="1" />
                 <text y="3" fontSize="10" fill={colors.rectText} textAnchor="middle" fontWeight="bold">pH {cPH}</text>
            </g>

            {/* Recommended Point - Pulse Effect */}
            <circle cx={cxRec} cy={cyRec} r="6" fill="#8b5cf6" stroke={colors.bg} strokeWidth="2" />
            <circle cx={cxRec} cy={cyRec} r="6" className="animate-ping" fill="#8b5cf6" opacity="0.5" stroke="none" style={{ transformOrigin: 'center', transformBox: 'fill-box' }} />
            
            <g transform={`translate(${cxRec}, ${cyRec - 25})`}>
                 <rect x="-22" y="-10" width="44" height="20" rx="4" fill="#8b5cf6" />
                 <text y="3" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">pH {rPH}</text>
            </g>
        </svg>
    </div>
  );
};

// Modal for Tests
const TestRunnerModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const [results, setResults] = useState<TestResult[]>([]);
    
    useEffect(() => {
        if(isOpen) {
            setResults(runAllTests());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const passedCount = results.filter(r => r.passed).length;
    const allPassed = passedCount === results.length;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck className={allPassed ? "text-emerald-500" : "text-amber-500"} />
                        <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">System Diagnostics / Unit Tests</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <XCircle size={24} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900">
                    <div className="mb-4 flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className={`text-2xl font-bold ${allPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {passedCount} / {results.length}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Tests Passed. System Integrity: {allPassed ? '100%' : 'WARNING'}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {results.map((res, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{res.module}</div>
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{res.name}</div>
                                    {!res.passed && (
                                        <div className="mt-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-2 rounded">
                                            <div>Expected: {res.expected}</div>
                                            <div>Actual: {res.actual}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="ml-4">
                                    {res.passed ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                                            <CheckCircle size={12} /> PASS
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
                                            <AlertTriangle size={12} /> FAIL
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-xl flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
                    >
                        Close Diagnostics
                    </button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
  // State
  const [aqIn, setAqIn] = useState<Concentrations>({ Nd: 5.0, Th: 0.1, Fe: 0.5, U: 0.02 });
  const [orgIn, setOrgIn] = useState<Concentrations>({ Nd: 0.0, Th: 0.0, Fe: 0.0, U: 0.0 });
  const [phaseRatio, setPhaseRatio] = useState(1.0);
  const [dValues, setDValues] = useState<Concentrations>({ Nd: 0.8, Th: 10.0, Fe: 5.0, U: 12.0 });
  
  const [currentPH, setCurrentPH] = useState(1.5);
  const [targetPH, setTargetPH] = useState(1.8);
  const [regLimit, setRegLimit] = useState(0.1);

  const [showTests, setShowTests] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [darkMode, setDarkMode] = useState(false);

  // Computed Results
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult | null>(null);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResult | null>(null);

  // Run Simulation
  const runSimulation = () => {
    // Module 1
    const simRes = simulate_sx_stage(aqIn, orgIn, phaseRatio, dValues);
    setSimulationResults(simRes);

    // Module 3 (Using Aq Out as Waste Stream per prompt)
    const thConc = simRes.aqOut['Th'] || 0;
    const uConc = simRes.aqOut['U'] || 0;
    const compRes = check_th_u_compliance(thConc, uConc, regLimit);
    setComplianceResults(compRes);

    // Module 2
    const optRes = prescriptive_setpoint_optimizer(currentPH, targetPH);
    setOptimizationResults(optRes);
  };

  // Run on mount and when inputs change (debounced slightly or just effect)
  useEffect(() => {
    runSimulation();
  }, [aqIn, orgIn, phaseRatio, dValues, currentPH, targetPH, regLimit]);

  // Handle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const updateAqIn = (key: string, val: number) => setAqIn(prev => ({ ...prev, [key]: val }));
  const updateD = (key: string, val: number) => setDValues(prev => ({ ...prev, [key]: val }));

  const captureSnapshot = () => {
    if (!simulationResults || !complianceResults || !optimizationResults) return;

    const newEntry: HistoryEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      inputs: {
        aqIn: { ...aqIn },
        phaseRatio,
        currentPH,
        targetPH,
      },
      outputs: {
        th_u_total: complianceResults.total_conc_gl,
        is_compliant: complianceResults.is_compliant,
        efficiency: optimizationResults.predicted_efficiency,
      }
    };

    setHistory(prev => [newEntry, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-200">
      <style>{`
        @keyframes pop-status {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-status-change {
          animation: pop-status 0.4s ease-out forwards;
        }
      `}</style>
      <TestRunnerModal isOpen={showTests} onClose={() => setShowTests(false)} />
      
      {/* Header */}
      <header className="bg-slate-900 dark:bg-slate-950 text-white pt-8 pb-24 px-6 relative overflow-hidden transition-colors">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="text-blue-400" size={28} />
                <h1 className="text-3xl font-bold tracking-tight">HDT Dashboard</h1>
              </div>
              <button 
                onClick={toggleDarkMode}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-200 transition-colors"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
          </div>
          <p className="text-slate-400 max-w-2xl text-lg">
            Hydrometallurgical Digital Twin: Integrated Thermodynamic Simulation, AI Optimization, and Regulatory Compliance.
          </p>
        </div>
        
        {/* Abstract Background pattern */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0 100 L100 0 L100 100 Z" fill="white" />
          </svg>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 -mt-16 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-20">
        
        {/* Module 1: Thermodynamic Core */}
        <div className="lg:col-span-8 space-y-6">
          <Card 
            title="Module 1: Thermodynamic Core (SX Simulator)" 
            icon={<FlaskConical className="text-blue-600 dark:text-blue-400" size={20} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feed Inputs */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2">Feed Conditions (Aq)</h3>
                
                <InputField 
                  label="[Nd] Target (g/L)" 
                  value={aqIn.Nd} 
                  onChange={(v: number) => updateAqIn('Nd', v)} 
                  min={0}
                />
                <InputField 
                  label="[Fe] Impurity (g/L)" 
                  value={aqIn.Fe} 
                  onChange={(v: number) => updateAqIn('Fe', v)}
                  min={0}
                />
                <InputField 
                  label="[Th] Radioactive (g/L)" 
                  value={aqIn.Th} 
                  onChange={(v: number) => updateAqIn('Th', v)}
                  min={0}
                />
                <InputField 
                  label="[U] Radioactive (g/L)" 
                  value={aqIn.U} 
                  onChange={(v: number) => updateAqIn('U', v)}
                  min={0}
                />

                <div className="pt-2">
                   <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">Process Params</h3>
                   <InputField 
                     label="Phase Ratio (O/A)" 
                     value={phaseRatio} 
                     onChange={setPhaseRatio}
                     min={0.1}
                     step="0.1"
                   />
                </div>
              </div>

              {/* D Values */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2">Distribution Coeffs (D)</h3>
                
                <InputField 
                  label="D_Nd (Target)" 
                  value={dValues.Nd} 
                  onChange={(v: number) => updateD('Nd', v)}
                  min={0}
                />
                <InputField 
                  label="D_Fe (Impurity)" 
                  value={dValues.Fe} 
                  onChange={(v: number) => updateD('Fe', v)}
                  min={0}
                />

                {/* Regulatory D Values */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md border border-amber-100 dark:border-amber-900/50">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-2">Compliance D-Values</span>
                  <InputField 
                    label="D_Th (High Ext)" 
                    value={dValues.Th} 
                    onChange={(v: number) => updateD('Th', v)} 
                    className="mb-2 last:mb-0"
                    min={0}
                  />
                  <InputField 
                    label="D_U (High Ext)" 
                    value={dValues.U} 
                    onChange={(v: number) => updateD('U', v)} 
                    className="mb-0"
                    min={0}
                  />
                </div>
              </div>

              {/* Outputs Table */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                 <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <BarChart3 size={16}/> Simulation Output
                 </h3>
                 {simulationResults && (
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead>
                         <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                           <th className="pb-2">Specie</th>
                           <th className="pb-2 text-right">Aq Out</th>
                           <th className="pb-2 text-right">Org Out</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                         {['Nd', 'Fe', 'Th', 'U'].map(el => (
                           <tr key={el} className={['Th', 'U'].includes(el) ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}>
                             <td className="py-2 font-medium text-slate-700 dark:text-slate-300">
                               {el}
                               {['Th', 'U'].includes(el) && <span className="text-[10px] ml-1 text-amber-600 dark:text-amber-500">(Reg)</span>}
                             </td>
                             <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-400">{simulationResults.aqOut[el] ?? 0}</td>
                             <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-400">{simulationResults.orgOut[el] ?? 0}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
              </div>
            </div>
          </Card>

          {/* Integrated Execution Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Module 2: AI Optimizer */}
              <Card 
                title="Module 2: Scientific AI Optimizer" 
                icon={<Settings className="text-purple-600 dark:text-purple-400" size={20} />}
                className="h-full"
              >
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <InputField 
                              label="Current pH" 
                              value={currentPH} 
                              onChange={setCurrentPH} 
                              step="0.05"
                              min={0}
                              max={14}
                            />
                        </div>
                        <div className="flex-1">
                            <InputField 
                              label="Target Optimal pH" 
                              value={targetPH} 
                              onChange={setTargetPH} 
                              step="0.05"
                              min={0}
                              max={14}
                            />
                        </div>
                    </div>
                    
                    {optimizationResults && (
                        <>
                          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-100 dark:border-purple-900/50">
                              <div className="flex justify-between items-start mb-3">
                                  <div>
                                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Recommendation</span>
                                      <div className="text-lg font-bold text-purple-900 dark:text-purple-200 mt-1">
                                          Setpoint: pH {optimizationResults.new_pH_setpoint}
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Est. Efficiency</span>
                                      <div className="text-lg font-bold text-purple-900 dark:text-purple-200 mt-1">
                                          {(optimizationResults.predicted_efficiency * 100).toFixed(1)}%
                                      </div>
                                  </div>
                              </div>
                              <div className="text-sm text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                  <ArrowRight size={16} />
                                  {optimizationResults.action}
                              </div>
                          </div>
                          
                          <EfficiencyChart 
                            currentPH={currentPH} 
                            recommendedPH={optimizationResults.new_pH_setpoint} 
                            targetOptimalPH={targetPH}
                            isDarkMode={darkMode}
                          />
                        </>
                    )}
                </div>
              </Card>

              {/* Module 3: Compliance Simulator */}
              <Card 
                title="Module 3: Compliance Simulator" 
                icon={<AlertTriangle className="text-amber-600 dark:text-amber-500" size={20} />}
                className="h-full"
              >
                <div className="space-y-6">
                     <div>
                        <InputField 
                          label="Reg. Limit (Th + U) g/L" 
                          value={regLimit} 
                          onChange={setRegLimit} 
                          min={0.001}
                          step="0.01"
                        />
                     </div>
                     
                     {complianceResults && (
                         <div 
                             key={complianceResults.is_compliant ? 'comp' : 'non-comp'}
                             className={`rounded-lg p-5 border-l-4 animate-status-change ${complianceResults.is_compliant ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'}`}
                         >
                             <div className="flex items-center gap-2 mb-2">
                                 {complianceResults.is_compliant ? (
                                     <CheckCircle className="text-emerald-600 dark:text-emerald-500" size={24} />
                                 ) : (
                                     <AlertTriangle className="text-red-600 dark:text-red-500" size={24} />
                                 )}
                                 <span className={`text-lg font-bold ${complianceResults.is_compliant ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                                     {complianceResults.is_compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
                                 </span>
                             </div>
                             
                             <div className="text-sm font-mono text-slate-600 dark:text-slate-300 mb-2">
                                 Total Th+U: <strong>{complianceResults.total_conc_gl} g/L</strong>
                             </div>
                             
                             <p className={`text-sm ${complianceResults.is_compliant ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                 {complianceResults.finding}
                             </p>
                         </div>
                     )}
                     
                     <div className="text-xs text-slate-400 italic mt-4">
                         *Checks Aqueous Output stream against regulatory limits.
                     </div>
                </div>
              </Card>
          </div>

          {/* New Section: Historical Data Log */}
          <Card 
            title="Simulation Historical Log" 
            icon={<History className="text-slate-600 dark:text-slate-400" size={20} />}
          >
            {history.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                    No history recorded yet. Use the "Capture Snapshot" button to log data.
                </div>
            ) : (
                <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 font-medium">Time</th>
                                <th className="px-4 py-2 font-medium text-center">Phase Ratio</th>
                                <th className="px-4 py-2 font-medium text-center">pH</th>
                                <th className="px-4 py-2 font-medium text-center">Feed Th/U</th>
                                <th className="px-4 py-2 font-medium text-center">Waste Th+U</th>
                                <th className="px-4 py-2 font-medium text-center">Efficiency</th>
                                <th className="px-4 py-2 font-medium text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {history.map((entry, index) => (
                                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs flex items-center gap-1">
                                        <Clock size={12} /> {entry.timestamp}
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-700 dark:text-slate-300">{entry.inputs.phaseRatio.toFixed(1)}</td>
                                    <td className="px-4 py-2 text-center text-slate-700 dark:text-slate-300">{entry.inputs.currentPH.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center text-slate-500 dark:text-slate-400 text-xs">
                                        {entry.inputs.aqIn.Th}/{entry.inputs.aqIn.U}
                                    </td>
                                    <td className={`px-4 py-2 text-center font-bold ${entry.outputs.is_compliant ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {entry.outputs.th_u_total.toFixed(4)}
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-700 dark:text-slate-300">
                                        {(entry.outputs.efficiency * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        {entry.outputs.is_compliant ? (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase ${index === 0 ? 'animate-status-change' : ''}`}>
                                                PASS
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase ${index === 0 ? 'animate-status-change' : ''}`}>
                                                FAIL
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
          </Card>
        </div>

        {/* Sidebar / Info */}
        <div className="lg:col-span-4 space-y-6">
             <div className="bg-slate-800 dark:bg-slate-900 text-slate-300 rounded-xl p-6 shadow-lg sticky top-6 border border-slate-700">
                <h3 className="text-white font-bold text-lg mb-4">System Logic</h3>
                <ul className="space-y-4 text-sm">
                    <li className="flex gap-3">
                        <span className="bg-slate-700 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">1</span>
                        <span>
                            <strong className="text-white block">Equilibrium Engine</strong>
                            Calculates distribution based on D-values and O/A ratio using mass balance equations.
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="bg-slate-700 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">2</span>
                        <span>
                            <strong className="text-white block">Prescriptive AI</strong>
                            Simulates a non-linear process model to recommend optimal pH setpoints for maximizing Nd recovery.
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="bg-slate-700 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">3</span>
                        <span>
                            <strong className="text-white block">Safety Check</strong>
                            Real-time monitoring of radioactive impurities (Th, U) against statutory limits.
                        </span>
                    </li>
                </ul>
                
                <div className="mt-8 pt-6 border-t border-slate-700 space-y-3">
                     <button 
                        onClick={captureSnapshot}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                    >
                        <Save size={16} />
                        Capture Snapshot
                    </button>
                    
                    <button 
                        onClick={() => setShowTests(true)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-all group"
                    >
                        <Play size={16} className="text-blue-400 group-hover:text-blue-300" />
                        Run System Diagnostics
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-1">
                        Log current state or verify logic integrity.
                    </p>
                </div>
             </div>
             
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sticky top-[32rem]">
                 <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Simulation Status</h3>
                 <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                     <span className="relative flex h-3 w-3">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                     </span>
                     Active · Real-time
                 </div>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                     Parameters update automatically.
                 </p>
             </div>
        </div>
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}