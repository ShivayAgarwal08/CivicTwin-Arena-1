import React from 'react';
import type { ComparisonReport, AuthorType, SpilloverStatus } from '../types/traffic';
import { AlertTriangle, CheckCircle, Info, ArrowRight, ShieldAlert } from 'lucide-react';

interface SpilloverInspectorProps {
  report: ComparisonReport | null;
  activeAlternative: AuthorType;
}

export const SpilloverInspector: React.FC<SpilloverInspectorProps> = ({
  report,
  activeAlternative,
}) => {
  if (!report) {
    return (
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-8 text-center text-xs text-[#667085]">
        Run the simulation to inspect network-wide spillover effects on surrounding streets.
      </div>
    );
  }

  const currentResult =
    activeAlternative === 'HUMAN'
      ? report.human_proposal
      : activeAlternative === 'AI'
      ? report.ai_proposal
      : report.baseline;

  const baselineResults = report.baseline.link_results;
  const linkList = Object.values(currentResult.link_results);

  // Filter non-directly modified links (true spillover candidates)
  const spilloverLinks = linkList.filter((l) => !l.is_directly_modified);

  const getStatusBadge = (status: SpilloverStatus) => {
    switch (status) {
      case 'newly_congested':
        return (
          <span className="bg-red-100 text-red-800 border border-red-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
            Newly Congested (V/C &ge; 0.95)
          </span>
        );
      case 'deteriorated':
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
            Deteriorated (+20% Delay)
          </span>
        );
      case 'moderate':
        return (
          <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium px-2 py-0.5 rounded text-[10px] uppercase">
            Moderate (+5-20%)
          </span>
        );
      case 'improved':
        return (
          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
            Improved (Relieved)
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px]">
            Neutral
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#E5DEC9] rounded-xl overflow-hidden shadow-sm">
      {/* Header Summary */}
      <div className="p-4 border-b border-[#E5DEC9] bg-[#FBF9F5] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-[#1F2421] text-xs uppercase tracking-wide flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>Spillover Impact on Surrounding Road Corridors</span>
          </h3>
          <p className="text-[11px] text-[#667085] mt-0.5">
            Evaluates how interventions alter flow and queue propagation on non-intervened neighboring links.
          </p>
        </div>

        {activeAlternative !== 'BASELINE' && (
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              {currentResult.metrics.spillover_counts.improved || 0} Relieved
            </span>
            <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              {currentResult.metrics.spillover_counts.deteriorated || 0} Deteriorated
            </span>
            <span className="text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
              {currentResult.metrics.spillover_counts.newly_congested || 0} New Choke Points
            </span>
          </div>
        )}
      </div>

      {activeAlternative === 'BASELINE' ? (
        <div className="p-6 text-center text-xs text-[#667085]">
          Baseline Network represents the reference state against which proposals are measured. Switch to <strong>My Proposal</strong> or <strong>AI Alternative</strong> to inspect induced spillover differences.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F4F0E8] border-b border-[#E5DEC9] text-[#1F2421]">
                <th className="py-2.5 px-4 font-bold">Surrounding Road Link</th>
                <th className="py-2.5 px-4 font-bold">Baseline V/C &rarr; Proposed V/C</th>
                <th className="py-2.5 px-4 font-bold">Delay Change</th>
                <th className="py-2.5 px-4 font-bold">Spillover Classification</th>
                <th className="py-2.5 px-4 font-bold">Traffic Engineering Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DEC9]">
              {spilloverLinks.map((l) => {
                const bRes = baselineResults[l.link_id];
                const baseVc = bRes ? bRes.vc_ratio : 0.5;
                const baseDelay = bRes ? bRes.delay_sec_per_veh : 0.0;
                const deltaDelay = l.delay_sec_per_veh - baseDelay;

                return (
                  <tr key={l.link_id} className="hover:bg-[#FBF9F5] transition-colors">
                    <td className="py-2.5 px-4 font-medium text-[#1F2421]">
                      <div>{l.link_name}</div>
                      <span className="text-[10px] text-[#667085] capitalize">
                        {l.highway_type} street
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">
                      <span>{baseVc.toFixed(2)}</span>
                      <span className="text-[#667085] mx-1.5">&rarr;</span>
                      <span
                        className={`font-bold ${
                          l.vc_ratio >= 1.0 ? 'text-[#DC2626]' : 'text-[#1F2421]'
                        }`}
                      >
                        {l.vc_ratio.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium">
                      <span
                        className={
                          deltaDelay > 2.0
                            ? 'text-red-700'
                            : deltaDelay < -2.0
                            ? 'text-emerald-700'
                            : 'text-[#667085]'
                        }
                      >
                        {deltaDelay > 0 ? '+' : ''}
                        {deltaDelay.toFixed(1)}s
                      </span>
                    </td>
                    <td className="py-2.5 px-4">{getStatusBadge(l.spillover_status)}</td>
                    <td className="py-2.5 px-4 text-[#475467] text-[11px] max-w-sm">
                      {l.spillover_explanation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
