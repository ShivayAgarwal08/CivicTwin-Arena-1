import React from 'react';
import type { ComparisonReport, WinnerType, AuthorType } from '../types/traffic';
import { Trophy, TrendingDown, TrendingUp, AlertTriangle, ShieldCheck, Check } from 'lucide-react';

interface ComparisonTableProps {
  report: ComparisonReport | null;
  onSelectAlternative: (alt: AuthorType) => void;
  activeAlternative: AuthorType;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  report,
  onSelectAlternative,
  activeAlternative,
}) => {
  if (!report) {
    return (
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-8 text-center text-xs text-[#94A3B8]">
        Run the simulation to inspect the fair 3-alternative comparison metrics table.
      </div>
    );
  }

  const { baseline, human_proposal, ai_proposal, preferred_winner, winner_headline, winner_rationale } =
    report;

  const renderDelta = (val: number, baseVal: number, unit: string, lowerIsBetter: boolean = true) => {
    const diff = val - baseVal;
    const pct = baseVal !== 0 ? (diff / baseVal) * 100.0 : 0.0;
    if (Math.abs(diff) < 0.05) {
      return <span className="text-[#64748B] font-mono text-[11px]">—</span>;
    }
    const isGood = lowerIsBetter ? diff < 0 : diff > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          isGood
            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
            : 'bg-red-950/70 text-red-400 border border-red-800/60'
        }`}
      >
        {diff > 0 ? '+' : ''}
        {diff.toFixed(1)} {unit} ({diff > 0 ? '+' : ''}
        {pct.toFixed(0)}%)
      </span>
    );
  };

  const rows = [
    {
      label: 'Average Journey Time',
      unit: 'min',
      base: baseline.metrics.avg_journey_time_min,
      human: human_proposal.metrics.avg_journey_time_min,
      ai: ai_proposal.metrics.avg_journey_time_min,
      lowerIsBetter: true,
      desc: 'Network-wide average trip duration',
    },
    {
      label: 'Average Vehicle Delay',
      unit: 's/veh',
      base: baseline.metrics.avg_vehicle_delay_sec,
      human: human_proposal.metrics.avg_vehicle_delay_sec,
      ai: ai_proposal.metrics.avg_vehicle_delay_sec,
      lowerIsBetter: true,
      desc: 'Per-vehicle delay vs free flow speed',
    },
    {
      label: 'Maximum Queue Length',
      unit: 'm',
      base: baseline.metrics.max_queue_length_m,
      human: human_proposal.metrics.max_queue_length_m,
      ai: ai_proposal.metrics.max_queue_length_m,
      lowerIsBetter: true,
      desc: 'Worst backlog encountered in corridor',
    },
    {
      label: 'Total Delay Hours',
      unit: 'veh-h',
      base: baseline.metrics.total_network_delay_veh_hours,
      human: human_proposal.metrics.total_network_delay_veh_hours,
      ai: ai_proposal.metrics.total_network_delay_veh_hours,
      lowerIsBetter: true,
      desc: 'Cumulative hours lost by all vehicles',
    },
    {
      label: 'Network Throughput',
      unit: 'vph',
      base: baseline.metrics.network_throughput_vph,
      human: human_proposal.metrics.network_throughput_vph,
      ai: ai_proposal.metrics.network_throughput_vph,
      lowerIsBetter: false,
      desc: 'Total vehicles cleared per peak hour',
    },
    {
      label: 'Deteriorated Spillover Links',
      unit: 'links',
      base: baseline.metrics.spillover_counts?.deteriorated ?? 0,
      human: human_proposal.metrics.spillover_counts?.deteriorated ?? 0,
      ai: ai_proposal.metrics.spillover_counts?.deteriorated ?? 0,
      lowerIsBetter: true,
      desc: 'Surrounding streets with >20% delay jump',
    },
    {
      label: 'Estimated Capital Cost',
      unit: 'INR',
      base: 0,
      human: human_proposal.proposal.interventions.reduce((s, i) => s + i.estimated_cost_inr, 0),
      ai: ai_proposal.proposal.interventions.reduce((s, i) => s + i.estimated_cost_inr, 0),
      lowerIsBetter: true,
      desc: 'Implementation cost in Lakhs',
      isCost: true,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Winner Banner */}
      <div className="bg-[#151D29] border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Recommended Outcome
              </span>
              <span className="text-xs font-bold text-[#E8EDF4]">
                Winner: Alternative {preferred_winner}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] font-medium mt-0.5">{winner_headline}</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[10px] text-[#64748B] block">Normalized Score</span>
          <span className="text-xs font-bold text-emerald-400">
            {preferred_winner === 'HUMAN'
              ? human_proposal.metrics.score_breakdown?.total_score?.toFixed(1)
              : preferred_winner === 'AI'
              ? ai_proposal.metrics.score_breakdown?.total_score?.toFixed(1)
              : baseline.metrics.score_breakdown?.total_score?.toFixed(1)}{' '}
            / 100
          </span>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-left text-xs text-[#E8EDF4]">
          <thead className="bg-[#101722] border-b border-[#293548] text-[11px] font-bold text-[#94A3B8]">
            <tr>
              <th className="py-2.5 px-3">Performance Metric</th>
              <th className="py-2.5 px-3 text-right">
                <button
                  onClick={() => onSelectAlternative('BASELINE')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    activeAlternative === 'BASELINE'
                      ? 'bg-[#1C2634] text-white border border-[#293548]'
                      : 'hover:text-[#E8EDF4]'
                  }`}
                >
                  A. Baseline
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  onClick={() => onSelectAlternative('HUMAN')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    activeAlternative === 'HUMAN'
                      ? 'bg-blue-600 text-white'
                      : 'hover:text-blue-400'
                  }`}
                >
                  B. Human Proposal
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  onClick={() => onSelectAlternative('AI')}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    activeAlternative === 'AI'
                      ? 'bg-purple-600 text-white'
                      : 'hover:text-purple-400'
                  }`}
                >
                  C. AI Proposal
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#293548]">
            {rows.map((r, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? 'bg-[#151D29]/50 hover:bg-[#1C2634]' : 'bg-[#101722]/40 hover:bg-[#1C2634]'}
              >
                <td className="py-2 px-3">
                  <div className="font-medium text-[#E8EDF4] text-xs">{r.label}</div>
                  <div className="text-[10px] text-[#64748B]">{r.desc}</div>
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs text-[#94A3B8]">
                  {r.isCost
                    ? '₹0'
                    : `${r.base.toFixed(1)} ${r.unit}`}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">
                  {r.isCost ? (
                    <span className="text-[#E8EDF4]">₹{(r.human / 100000).toFixed(1)}L</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="text-[#E8EDF4]">{r.human.toFixed(1)} {r.unit}</div>
                      <div>{renderDelta(r.human, r.base, r.unit, r.lowerIsBetter)}</div>
                    </div>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">
                  {r.isCost ? (
                    <span className="text-[#E8EDF4]">₹{(r.ai / 100000).toFixed(1)}L</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="text-[#E8EDF4]">{r.ai.toFixed(1)} {r.unit}</div>
                      <div>{renderDelta(r.ai, r.base, r.unit, r.lowerIsBetter)}</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
