import React from 'react';
import type { ComparisonReport } from '../types/traffic';
import { FileText, Trophy, CheckCircle, AlertTriangle, X, Printer, ShieldCheck } from 'lucide-react';

interface DecisionReportModalProps {
  report: ComparisonReport;
  isOpen: boolean;
  onClose: () => void;
}

export const DecisionReportModal: React.FC<DecisionReportModalProps> = ({
  report,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const {
    location_name,
    problem_statement,
    objective_extracted,
    preferred_winner,
    winner_headline,
    winner_rationale,
    trade_offs_identified,
    sensitivity_and_robustness,
    limitations_and_assumptions,
    baseline,
    human_proposal,
    ai_proposal,
  } = report;

  const winningResult =
    preferred_winner === 'HUMAN'
      ? human_proposal
      : preferred_winner === 'AI'
      ? ai_proposal
      : baseline;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#151D29] border border-[#293548] rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-[#E8EDF4] max-h-[90vh] overflow-y-auto space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#293548] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded">
                Official Urban Planning Evaluation Brief
              </span>
              <h2 className="text-lg font-bold text-[#E8EDF4] mt-0.5">{location_name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#293548] bg-[#101722] hover:bg-[#1C2634] text-xs font-semibold text-[#94A3B8] hover:text-[#E8EDF4] transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Brief</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Executive Summary & Recommendation Banner */}
        <div className="bg-[#101722] border border-emerald-500/30 rounded-xl p-4 flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Recommended Alternative
              </span>
              <span className="text-sm font-bold text-[#E8EDF4]">
                Alternative {preferred_winner} ({winningResult.proposal.title})
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-300">{winner_headline}</p>
            <p className="text-xs text-[#94A3B8] leading-relaxed pt-1">{winner_rationale}</p>
          </div>
        </div>

        {/* Context & Objectives */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Corridor Problem Context
            </span>
            <p className="text-xs text-[#E8EDF4] leading-relaxed">{problem_statement}</p>
          </div>

          <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Planning Objective
            </span>
            <p className="text-xs text-[#E8EDF4] leading-relaxed">{objective_extracted}</p>
          </div>
        </div>

        {/* Key Trade-offs Identified */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Key Engineering &amp; Operational Trade-offs</span>
          </h3>
          <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-2">
            {trade_offs_identified.map((t: any, idx: number) => {
              const text = typeof t === 'string' ? t : `${t.category}: ${t.explanation}`;
              return (
                <div key={idx} className="flex items-start gap-2 text-xs text-[#94A3B8]">
                  <span className="text-amber-400 font-bold">•</span>
                  <span className="leading-relaxed">{text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric Comparison Snapshot */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            3-Way Performance Verification Snapshot
          </h3>
          <div className="bg-[#101722] border border-[#293548] rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#151D29] border-b border-[#293548] text-[11px] text-[#94A3B8] font-bold">
                <tr>
                  <th className="py-2 px-3">Metric</th>
                  <th className="py-2 px-3 text-right">A. Baseline</th>
                  <th className="py-2 px-3 text-right">B. Human Proposal</th>
                  <th className="py-2 px-3 text-right">C. AI Proposal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#293548] font-mono text-xs text-[#E8EDF4]">
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-[#94A3B8]">Avg Delay (s/veh)</td>
                  <td className="py-2 px-3 text-right">
                    {baseline.metrics.avg_vehicle_delay_sec.toFixed(1)}s
                  </td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    {human_proposal.metrics.avg_vehicle_delay_sec.toFixed(1)}s
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    {ai_proposal.metrics.avg_vehicle_delay_sec.toFixed(1)}s
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-[#94A3B8]">Max Queue (m)</td>
                  <td className="py-2 px-3 text-right">
                    {baseline.metrics.max_queue_length_m.toFixed(0)}m
                  </td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    {human_proposal.metrics.max_queue_length_m.toFixed(0)}m
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    {ai_proposal.metrics.max_queue_length_m.toFixed(0)}m
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-[#94A3B8]">Throughput (vph)</td>
                  <td className="py-2 px-3 text-right">
                    {baseline.metrics.network_throughput_vph.toFixed(0)} vph
                  </td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    {human_proposal.metrics.network_throughput_vph.toFixed(0)} vph
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    {ai_proposal.metrics.network_throughput_vph.toFixed(0)} vph
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-[#94A3B8]">
                    Deteriorated Spillover
                  </td>
                  <td className="py-2 px-3 text-right">
                    {baseline.metrics.spillover_counts?.deteriorated ?? 0} links
                  </td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    {human_proposal.metrics.spillover_counts?.deteriorated ?? 0} links
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    {ai_proposal.metrics.spillover_counts?.deteriorated ?? 0} links
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-[#94A3B8]">Estimated Cost</td>
                  <td className="py-2 px-3 text-right">₹0</td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    ₹
                    {(
                      human_proposal.proposal.interventions.reduce(
                        (s, i) => s + i.estimated_cost_inr,
                        0
                      ) / 100000
                    ).toFixed(1)}
                    L
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    ₹
                    {(
                      ai_proposal.proposal.interventions.reduce(
                        (s, i) => s + i.estimated_cost_inr,
                        0
                      ) / 100000
                    ).toFixed(1)}
                    L
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Robustness & Assumptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Sensitivity &amp; Robustness Check
            </span>
            <p className="text-[#94A3B8] leading-relaxed">{sensitivity_and_robustness}</p>
          </div>

          <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Methodological Assumptions
            </span>
            <div className="space-y-1">
              {Array.isArray(limitations_and_assumptions) ? (
                limitations_and_assumptions.map((a, i) => (
                  <p key={i} className="text-[#94A3B8] leading-relaxed">• {a}</p>
                ))
              ) : (
                <p className="text-[#94A3B8] leading-relaxed">{limitations_and_assumptions}</p>
              )}
            </div>
          </div>
        </div>

        {/* Data Provenance & Real-World Caveat */}
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Data Provenance &amp; Real-World Implementation Caveat
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-[#94A3B8]">
            <div className="bg-[#101722] p-2 rounded border border-[#293548]">
              <strong className="text-[#E8EDF4] block">Network Geometry:</strong>
              <span>OpenStreetMap (WGS84)</span>
            </div>
            <div className="bg-[#101722] p-2 rounded border border-[#293548]">
              <strong className="text-[#E8EDF4] block">Capacity Code:</strong>
              <span>IRC:106-1990 Urban Standards</span>
            </div>
            <div className="bg-[#101722] p-2 rounded border border-[#293548]">
              <strong className="text-[#E8EDF4] block">Traffic Flow Physics:</strong>
              <span>BPR + Webster Queueing</span>
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed pt-1">
            CivicTwin Arena enforces scientific rigor: the recommended alternative reflects algorithmic multi-criteria optimization of modeled peak-hour queue and delay trade-offs. It is not an uncritical substitute for municipal engineering oversight, statutory environmental clearances, underground utility audits, and citizen public hearings.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#293548] pt-4 flex items-center justify-between text-xs text-[#64748B]">
          <span>Generated by CivicTwin Arena • Rigorous Multi-Alternative Decision Support</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#101722] hover:bg-[#1C2634] border border-[#293548] font-semibold text-[#E8EDF4] transition-colors cursor-pointer"
          >
            Close Brief
          </button>
        </div>
      </div>
    </div>
  );
};
