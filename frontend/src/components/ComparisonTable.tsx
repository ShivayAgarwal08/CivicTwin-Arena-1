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
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-8 text-center text-xs text-[#667085]">
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
      return <span className="text-gray-400 font-mono text-[11px]">—</span>;
    }
    const isGood = lowerIsBetter ? diff < 0 : diff > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded ${
          isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
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
      desc: 'Average delay above free-flow travel time',
    },
    {
      label: 'Maximum Queue Length',
      unit: 'm',
      base: baseline.metrics.max_queue_length_m,
      human: human_proposal.metrics.max_queue_length_m,
      ai: ai_proposal.metrics.max_queue_length_m,
      lowerIsBetter: true,
      desc: 'Longest queue backlog observed across network links',
    },
    {
      label: 'Average Queue Waiting Time',
      unit: 's',
      base: baseline.metrics.avg_queue_waiting_time_sec,
      human: human_proposal.metrics.avg_queue_waiting_time_sec,
      ai: ai_proposal.metrics.avg_queue_waiting_time_sec,
      lowerIsBetter: true,
      desc: 'Average time spent idling in oversaturated queues',
    },
    {
      label: 'Network Throughput',
      unit: 'vph',
      base: baseline.metrics.network_throughput_vph,
      human: human_proposal.metrics.network_throughput_vph,
      ai: ai_proposal.metrics.network_throughput_vph,
      lowerIsBetter: false,
      desc: 'Vehicles served and cleared per peak hour',
    },
    {
      label: 'Total Network Delay',
      unit: 'veh-hrs',
      base: baseline.metrics.total_network_delay_veh_hours,
      human: human_proposal.metrics.total_network_delay_veh_hours,
      ai: ai_proposal.metrics.total_network_delay_veh_hours,
      lowerIsBetter: true,
      desc: 'Cumulative commuter vehicle-hours lost to congestion',
    },
    {
      label: 'Peak Congestion Duration',
      unit: 'min',
      base: baseline.metrics.congestion_duration_min,
      human: human_proposal.metrics.congestion_duration_min,
      ai: ai_proposal.metrics.congestion_duration_min,
      lowerIsBetter: true,
      desc: 'Estimated time required for bottleneck queues to dissolve',
    },
    {
      label: 'Average V/C Ratio',
      unit: '',
      base: baseline.metrics.avg_vc_ratio,
      human: human_proposal.metrics.avg_vc_ratio,
      ai: ai_proposal.metrics.avg_vc_ratio,
      lowerIsBetter: true,
      desc: 'Network volume-to-capacity saturation degree',
    },
    {
      label: 'New Spillover Bottlenecks',
      unit: 'links',
      base: 0,
      human: human_proposal.metrics.spillover_counts.newly_congested || 0,
      ai: ai_proposal.metrics.spillover_counts.newly_congested || 0,
      lowerIsBetter: true,
      desc: 'Surrounding streets newly overwhelmed by diverted traffic',
    },
    {
      label: 'Estimated Capital Cost',
      unit: 'Lakhs ₹',
      base: 0,
      human: human_proposal.metrics.estimated_cost_inr_lakhs,
      ai: ai_proposal.metrics.estimated_cost_inr_lakhs,
      lowerIsBetter: true,
      desc: 'Civil engineering, signal hardware, or installation cost',
    },
  ];

  return (
    <div className="bg-white border border-[#E5DEC9] rounded-xl overflow-hidden shadow-sm">
      {/* Winner Announcement Banner */}
      <div
        className={`p-4 border-b flex items-start gap-3.5 ${
          preferred_winner === 'HUMAN'
            ? 'bg-[#E8F5E9] border-[#C8E6C9]'
            : preferred_winner === 'AI'
            ? 'bg-blue-50 border-blue-200'
            : 'bg-amber-50 border-amber-200'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            preferred_winner === 'HUMAN'
              ? 'bg-[#1B4332] text-[#A3E635]'
              : preferred_winner === 'AI'
              ? 'bg-[#2563EB] text-amber-300'
              : 'bg-amber-700 text-white'
          }`}
        >
          <Trophy className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 shadow-xs text-[#1F2421]">
              Preferred Alternative Selected: {preferred_winner}
            </span>
          </div>
          <h3 className="font-bold text-[#1F2421] text-sm mt-1">{winner_headline}</h3>
          <p className="text-xs text-[#475467] mt-1 leading-relaxed">{winner_rationale}</p>
        </div>
      </div>

      {/* Synchronized 3-Column Metrics Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FBF9F5] border-b border-[#E5DEC9]">
              <th className="py-3 px-4 font-bold text-[#1F2421] w-1/4">Evaluation Metric</th>
              <th
                onClick={() => onSelectAlternative('BASELINE')}
                className={`py-3 px-4 font-bold cursor-pointer transition-colors w-1/4 ${
                  activeAlternative === 'BASELINE' ? 'bg-[#F4F0E8] text-[#1F2421]' : 'text-[#667085]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>A. Baseline Network</span>
                  {preferred_winner === 'BASELINE' && <Trophy className="w-4 h-4 text-amber-600" />}
                </div>
              </th>
              <th
                onClick={() => onSelectAlternative('HUMAN')}
                className={`py-3 px-4 font-bold cursor-pointer transition-colors w-1/4 ${
                  activeAlternative === 'HUMAN'
                    ? 'bg-[#E8F5E9] text-[#1B4332]'
                    : 'text-[#667085] hover:text-[#1F2421]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>B. My Proposal</span>
                  {preferred_winner === 'HUMAN' && <Trophy className="w-4 h-4 text-[#1B4332]" />}
                </div>
              </th>
              <th
                onClick={() => onSelectAlternative('AI')}
                className={`py-3 px-4 font-bold cursor-pointer transition-colors w-1/4 ${
                  activeAlternative === 'AI'
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-[#667085] hover:text-[#1F2421]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>C. AI Alternative</span>
                  {preferred_winner === 'AI' && <Trophy className="w-4 h-4 text-blue-600" />}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DEC9]">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-[#FBF9F5]/60 transition-colors">
                <td className="py-2.5 px-4 font-medium text-[#1F2421]">
                  <div>{r.label}</div>
                  <div className="text-[10px] text-[#667085] font-normal">{r.desc}</div>
                </td>
                <td className="py-2.5 px-4 font-mono text-[#1F2421]">
                  {r.base.toFixed(1)} <span className="text-[10px] text-[#667085]">{r.unit}</span>
                </td>
                <td className="py-2.5 px-4">
                  <div className="font-mono text-[#1F2421] font-semibold">
                    {r.human.toFixed(1)} <span className="text-[10px] text-[#667085]">{r.unit}</span>
                  </div>
                  <div>{renderDelta(r.human, r.base, r.unit, r.lowerIsBetter)}</div>
                </td>
                <td className="py-2.5 px-4">
                  <div className="font-mono text-[#1F2421] font-semibold">
                    {r.ai.toFixed(1)} <span className="text-[10px] text-[#667085]">{r.unit}</span>
                  </div>
                  <div>{renderDelta(r.ai, r.base, r.unit, r.lowerIsBetter)}</div>
                </td>
              </tr>
            ))}

            {/* Composite Score Row */}
            <tr className="bg-[#FBF9F5] font-bold border-t-2 border-[#E5DEC9]">
              <td className="py-3 px-4 text-[#1F2421]">
                <div>Decision Score (0 - 100)</div>
                <div className="text-[10px] text-[#667085] font-normal">
                  Transparent multi-criteria weighting
                </div>
              </td>
              <td className="py-3 px-4 font-mono text-base text-[#1F2421]">
                {baseline.metrics.score_breakdown.total_score.toFixed(1)}
              </td>
              <td className="py-3 px-4">
                <div
                  className={`font-mono text-base font-bold ${
                    human_proposal.metrics.score_breakdown.total_score >
                    baseline.metrics.score_breakdown.total_score
                      ? 'text-[#1B4332]'
                      : 'text-[#1F2421]'
                  }`}
                >
                  {human_proposal.metrics.score_breakdown.total_score.toFixed(1)}
                </div>
                <div className="text-[10px] text-[#667085] font-normal">
                  Delay: {human_proposal.metrics.score_breakdown.delay_component}/35 | Spillover:{' '}
                  {human_proposal.metrics.score_breakdown.spillover_penalty}/25
                </div>
              </td>
              <td className="py-3 px-4">
                <div
                  className={`font-mono text-base font-bold ${
                    ai_proposal.metrics.score_breakdown.total_score >
                    baseline.metrics.score_breakdown.total_score
                      ? 'text-blue-700'
                      : 'text-[#1F2421]'
                  }`}
                >
                  {ai_proposal.metrics.score_breakdown.total_score.toFixed(1)}
                </div>
                <div className="text-[10px] text-[#667085] font-normal">
                  Delay: {ai_proposal.metrics.score_breakdown.delay_component}/35 | Spillover:{' '}
                  {ai_proposal.metrics.score_breakdown.spillover_penalty}/25
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
