import React, { useEffect, useState } from 'react';
import {
  FileText,
  Cpu,
  Layers,
  Activity,
  ShieldCheck,
  AlertTriangle,
  X,
  BookOpen,
  DollarSign,
  Info,
} from 'lucide-react';
import { fetchSimulationAssumptions } from '../api/client';

interface AssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssumptionsModal: React.FC<AssumptionsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchSimulationAssumptions()
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none font-sans">
      <div className="bg-[#151D29] border border-[#293548] rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-[#E8EDF4] max-h-[90vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#293548] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800/80 text-blue-400 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase bg-blue-950/60 border border-blue-900/60 px-2 py-0.5 rounded">
                Transparent Civil Engineering Specifications
              </span>
              <h2 className="text-lg font-bold text-[#E8EDF4] mt-0.5">
                Model Assumptions &amp; Data Provenance
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#94A3B8]">
            Loading engineering specifications...
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Regulatory Code Banner */}
            <div className="bg-[#101722] border border-[#293548] rounded-xl p-3 flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Regulatory Standard
                </span>
                <p className="text-xs font-semibold text-[#E8EDF4]">
                  {data?.regulatory_code || 'Indian Roads Congress IRC:106-1990'}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  Roadway capacities, design speeds, and level-of-service parameters adhere to Indian urban arterial guidelines.
                </p>
              </div>
            </div>

            {/* 4-Tier Data Provenance Model */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>4-Tier Data Provenance Architecture</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {data?.data_provenance_tiers?.map((tier: any, idx: number) => (
                  <div key={idx} className="bg-[#101722] border border-[#293548] p-3 rounded-xl space-y-1">
                    <span className="font-bold text-blue-300 text-[11px] block">{tier.tier}</span>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">{tier.description}</p>
                    <div className="text-[10px] text-[#64748B] pt-1">
                      <strong>Source: </strong>
                      <span>{tier.source || tier.coverage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mathematical Formulas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#101722] border border-[#293548] p-3 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Travel Time Function (BPR)
                </span>
                <code className="text-[11px] bg-[#151D29] text-emerald-300 p-2 rounded block font-mono">
                  {data?.traffic_flow_model?.formula}
                </code>
                <p className="text-[10px] text-[#94A3B8]">
                  Parameters: &alpha; = {data?.traffic_flow_model?.alpha}, &beta; = {data?.traffic_flow_model?.beta}.
                  Models congestion non-linear travel time penalty based on Volume-to-Capacity ratio.
                </p>
              </div>

              <div className="bg-[#101722] border border-[#293548] p-3 rounded-xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Signalized Intersection Delay (Webster)
                </span>
                <code className="text-[10px] bg-[#151D29] text-amber-300 p-2 rounded block font-mono">
                  d = [C*(1 - &lambda;)&sup2;] / [2*(1 - &lambda;x)] + [x&sup2;] / [2q*(1 - x)]
                </code>
                <p className="text-[10px] text-[#94A3B8]">
                  Cycle length C = 90s, effective green split &lambda; = 0.50, saturation flow s = 1800 vph/lane.
                </p>
              </div>
            </div>

            {/* Capacity Benchmarks Table */}
            <div className="bg-[#101722] border border-[#293548] rounded-xl overflow-hidden">
              <div className="bg-[#151D29] px-3 py-2 border-b border-[#293548] text-[11px] font-bold text-[#E8EDF4]">
                IRC:106 Roadway Capacity &amp; Speed Benchmarks
              </div>
              <div className="p-3 grid grid-cols-2 gap-2 text-[11px]">
                {data?.road_capacity_benchmarks_irc106 &&
                  Object.entries(data.road_capacity_benchmarks_irc106).map(([k, v]: any) => (
                    <div key={k} className="flex flex-col bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                      <span className="text-[#94A3B8] font-semibold capitalize">
                        {k.replace('_', ' ')}:
                      </span>
                      <strong className="text-[#E8EDF4] mt-0.5">{v}</strong>
                    </div>
                  ))}
              </div>
            </div>

            {/* Intervention Cost Parameters */}
            <div className="bg-[#101722] border border-[#293548] rounded-xl overflow-hidden">
              <div className="bg-[#151D29] px-3 py-2 border-b border-[#293548] text-[11px] font-bold text-[#E8EDF4] flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Intervention Financial Cost Parameters</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2 text-[11px]">
                {data?.intervention_cost_benchmarks &&
                  Object.entries(data.intervention_cost_benchmarks).map(([k, v]: any) => (
                    <div key={k} className="bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                      <span className="text-[#94A3B8] font-semibold capitalize block">
                        {k.replace('_', ' ')}:
                      </span>
                      <strong className="text-emerald-400 mt-0.5 block">{v}</strong>
                    </div>
                  ))}
              </div>
            </div>

            {/* Crucial Caveat Notice */}
            <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300 block text-[11px] uppercase tracking-wider">
                  Intellectual Honesty &amp; Real-World Limitations
                </span>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  CivicTwin Arena enforces strict intellectual honesty: simulation scores reflect mathematical equilibrium under modeled peak-hour demand. No live loop detector or vehicle probe feeds are currently claimed. Real municipal deployments mandate formal topographic surveys, utility clearances, and citizen hearings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="border-t border-[#293548] pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#101722] hover:bg-[#1C2634] border border-[#293548] font-semibold text-xs text-[#E8EDF4] transition-colors cursor-pointer"
          >
            Close Specifications
          </button>
        </div>
      </div>
    </div>
  );
};
