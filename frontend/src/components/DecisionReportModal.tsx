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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFFFF] border border-[#E5DEC9] rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-[#1F2421] max-h-[90vh] overflow-y-auto space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#E5DEC9] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4332] text-white flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#A3E635]" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-[#667085] uppercase bg-[#F4F0E8] px-2 py-0.5 rounded">
                Official Urban Planning Evaluation Brief
              </span>
              <h2 className="text-lg font-bold text-[#1F2421] mt-0.5">{location_name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B4332] border border-[#E5DEC9] rounded-lg hover:bg-[#F4F0E8] transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Brief</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#667085] hover:text-[#1F2421] p-1.5 rounded-lg hover:bg-[#F4F0E8] transition-all font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Problem Statement & Stated Objective */}
        <div className="bg-[#FBF9F5] border border-[#E5DEC9] p-4 rounded-xl text-xs space-y-2">
          <div>
            <span className="font-bold text-[#667085] text-[10px] uppercase tracking-wider block">
              Problem Context
            </span>
            <p className="font-medium text-[#1F2421] mt-0.5 leading-relaxed">{problem_statement}</p>
          </div>
          <div className="border-t border-[#E5DEC9]/80 pt-2">
            <span className="font-bold text-[#667085] text-[10px] uppercase tracking-wider block">
              Extracted Planning Objective
            </span>
            <p className="font-semibold text-[#1B4332] mt-0.5">{objective_extracted}</p>
          </div>
        </div>

        {/* Preferred Alternative Evidence Banner */}
        <div
          className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            preferred_winner === 'HUMAN'
              ? 'bg-[#E8F5E9] border-[#C8E6C9]'
              : preferred_winner === 'AI'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              preferred_winner === 'HUMAN'
                ? 'bg-[#1B4332] text-[#A3E635]'
                : preferred_winner === 'AI'
                ? 'bg-[#2563EB] text-amber-300'
                : 'bg-amber-700 text-white'
            }`}
          >
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F2421]">
              Recommended Course of Action: {preferred_winner} PROPOSAL
            </span>
            <h3 className="font-bold text-[#1F2421] text-sm mt-0.5">{winner_headline}</h3>
            <p className="text-xs text-[#475467] mt-1.5 leading-relaxed">{winner_rationale}</p>
          </div>
        </div>

        {/* Key Trade-Offs Identified */}
        <div>
          <h4 className="text-xs font-bold text-[#1F2421] uppercase tracking-wider mb-2.5">
            Explicit Trade-Offs & Multi-Criteria Evaluation
          </h4>
          <div className="border border-[#E5DEC9] rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#FBF9F5] border-b border-[#E5DEC9] text-[#1F2421]">
                <tr>
                  <th className="py-2.5 px-3.5 font-bold">Category</th>
                  <th className="py-2.5 px-3.5 font-bold">Baseline</th>
                  <th className="py-2.5 px-3.5 font-bold">Proposal Comparison</th>
                  <th className="py-2.5 px-3.5 font-bold">Engineering Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DEC9]">
                {trade_offs_identified.map((td, idx) => (
                  <tr key={idx} className="hover:bg-[#FBF9F5]/50">
                    <td className="py-2.5 px-3.5 font-semibold text-[#1F2421]">{td.category}</td>
                    <td className="py-2.5 px-3.5 font-mono text-[#667085]">{td.baseline_value}</td>
                    <td className="py-2.5 px-3.5 font-mono font-medium text-[#1F2421]">
                      {td.proposal_value}
                    </td>
                    <td className="py-2.5 px-3.5 text-[#475467] text-[11px]">{td.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Robustness Assessment & Limitations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-[#FBF9F5] border border-[#E5DEC9] p-3.5 rounded-xl">
            <span className="font-bold text-[#1F2421] block mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1B4332]" />
              <span>Sensitivity & Robustness</span>
            </span>
            <p className="text-[#667085] text-[11px] leading-relaxed">
              {sensitivity_and_robustness}
            </p>
          </div>

          <div className="bg-[#FBF9F5] border border-[#E5DEC9] p-3.5 rounded-xl">
            <span className="font-bold text-[#1F2421] block mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Engineering Assumptions & Boundaries</span>
            </span>
            <ul className="text-[#667085] text-[11px] list-disc list-inside space-y-1">
              {limitations_and_assumptions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#E5DEC9] pt-4 flex items-center justify-between text-xs text-[#667085]">
          <span>Generated by CivicTwin Arena deterministic simulation model.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1B4332] text-white font-semibold rounded-lg hover:bg-[#143225] transition-all"
          >
            Close Decision Brief
          </button>
        </div>
      </div>
    </div>
  );
};
