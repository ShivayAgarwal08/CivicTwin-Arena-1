import React from 'react';
import type { ComparisonReport } from '../types/traffic';
import { Clock, AlertOctagon, TrendingDown, Gauge } from 'lucide-react';

interface ComparisonChartsProps {
  report: ComparisonReport | null;
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-8 text-center text-xs text-[#94A3B8]">
        Run the simulation to generate comparative charts.
      </div>
    );
  }

  const { baseline, human_proposal, ai_proposal } = report;

  const maxDelay = Math.max(
    baseline.metrics.avg_vehicle_delay_sec,
    human_proposal.metrics.avg_vehicle_delay_sec,
    ai_proposal.metrics.avg_vehicle_delay_sec,
    10.0
  );

  const maxQueue = Math.max(
    baseline.metrics.max_queue_length_m,
    human_proposal.metrics.max_queue_length_m,
    ai_proposal.metrics.max_queue_length_m,
    50.0
  );

  const maxTotDelay = Math.max(
    baseline.metrics.total_network_delay_veh_hours,
    human_proposal.metrics.total_network_delay_veh_hours,
    ai_proposal.metrics.total_network_delay_veh_hours,
    1.0
  );

  const maxThroughput = Math.max(
    baseline.metrics.network_throughput_vph,
    human_proposal.metrics.network_throughput_vph,
    ai_proposal.metrics.network_throughput_vph,
    100.0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Chart 1: Average Vehicle Delay */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#E8EDF4]">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Average Vehicle Delay</span>
          </div>
          <span className="text-[10px] text-[#94A3B8] block mb-3">Delay per vehicle (seconds)</span>

          <div className="space-y-2 text-xs">
            {/* Baseline */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-[#94A3B8]">A. Baseline</span>
                <span className="font-mono text-[#E8EDF4]">
                  {baseline.metrics.avg_vehicle_delay_sec.toFixed(1)}s
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500 rounded-full"
                  style={{
                    width: `${(baseline.metrics.avg_vehicle_delay_sec / maxDelay) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Human */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-blue-400 font-medium">B. Human</span>
                <span className="font-mono text-blue-300 font-semibold">
                  {human_proposal.metrics.avg_vehicle_delay_sec.toFixed(1)}s
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${(human_proposal.metrics.avg_vehicle_delay_sec / maxDelay) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* AI */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-purple-400 font-medium">C. AI</span>
                <span className="font-mono text-purple-300 font-semibold">
                  {ai_proposal.metrics.avg_vehicle_delay_sec.toFixed(1)}s
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${(ai_proposal.metrics.avg_vehicle_delay_sec / maxDelay) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#293548] text-[10px] text-[#94A3B8] flex justify-between">
          <span>Target: Minimum delay</span>
          <span className="text-emerald-400 font-semibold">Lower is better</span>
        </div>
      </div>

      {/* Chart 2: Maximum Queue Length */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#E8EDF4]">
            <AlertOctagon className="w-4 h-4 text-amber-400" />
            <span>Max Queue Length</span>
          </div>
          <span className="text-[10px] text-[#94A3B8] block mb-3">Worst backlog length (meters)</span>

          <div className="space-y-2 text-xs">
            {/* Baseline */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-[#94A3B8]">A. Baseline</span>
                <span className="font-mono text-[#E8EDF4]">
                  {baseline.metrics.max_queue_length_m.toFixed(0)}m
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500 rounded-full"
                  style={{
                    width: `${(baseline.metrics.max_queue_length_m / maxQueue) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Human */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-blue-400 font-medium">B. Human</span>
                <span className="font-mono text-blue-300 font-semibold">
                  {human_proposal.metrics.max_queue_length_m.toFixed(0)}m
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${(human_proposal.metrics.max_queue_length_m / maxQueue) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* AI */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-purple-400 font-medium">C. AI</span>
                <span className="font-mono text-purple-300 font-semibold">
                  {ai_proposal.metrics.max_queue_length_m.toFixed(0)}m
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${(ai_proposal.metrics.max_queue_length_m / maxQueue) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#293548] text-[10px] text-[#94A3B8] flex justify-between">
          <span>Bottleneck reduction</span>
          <span className="text-emerald-400 font-semibold">Lower is better</span>
        </div>
      </div>

      {/* Chart 3: Total Network Delay */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#E8EDF4]">
            <TrendingDown className="w-4 h-4 text-purple-400" />
            <span>Total Delay Hours</span>
          </div>
          <span className="text-[10px] text-[#94A3B8] block mb-3">Vehicle-hours lost during peak</span>

          <div className="space-y-2 text-xs">
            {/* Baseline */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-[#94A3B8]">A. Baseline</span>
                <span className="font-mono text-[#E8EDF4]">
                  {baseline.metrics.total_network_delay_veh_hours.toFixed(1)}h
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500 rounded-full"
                  style={{
                    width: `${(baseline.metrics.total_network_delay_veh_hours / maxTotDelay) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Human */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-blue-400 font-medium">B. Human</span>
                <span className="font-mono text-blue-300 font-semibold">
                  {human_proposal.metrics.total_network_delay_veh_hours.toFixed(1)}h
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${(human_proposal.metrics.total_network_delay_veh_hours / maxTotDelay) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* AI */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-purple-400 font-medium">C. AI</span>
                <span className="font-mono text-purple-300 font-semibold">
                  {ai_proposal.metrics.total_network_delay_veh_hours.toFixed(1)}h
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${(ai_proposal.metrics.total_network_delay_veh_hours / maxTotDelay) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#293548] text-[10px] text-[#94A3B8] flex justify-between">
          <span>Economic time value</span>
          <span className="text-emerald-400 font-semibold">Lower is better</span>
        </div>
      </div>

      {/* Chart 4: Network Throughput */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-3.5 shadow-md flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#E8EDF4]">
            <Gauge className="w-4 h-4 text-blue-400" />
            <span>Network Throughput</span>
          </div>
          <span className="text-[10px] text-[#94A3B8] block mb-3">Vehicles cleared / hour (vph)</span>

          <div className="space-y-2 text-xs">
            {/* Baseline */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-[#94A3B8]">A. Baseline</span>
                <span className="font-mono text-[#E8EDF4]">
                  {baseline.metrics.network_throughput_vph.toFixed(0)} vph
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-500 rounded-full"
                  style={{
                    width: `${(baseline.metrics.network_throughput_vph / maxThroughput) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Human */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-blue-400 font-medium">B. Human</span>
                <span className="font-mono text-blue-300 font-semibold">
                  {human_proposal.metrics.network_throughput_vph.toFixed(0)} vph
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${(human_proposal.metrics.network_throughput_vph / maxThroughput) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* AI */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-purple-400 font-medium">C. AI</span>
                <span className="font-mono text-purple-300 font-semibold">
                  {ai_proposal.metrics.network_throughput_vph.toFixed(0)} vph
                </span>
              </div>
              <div className="h-2 w-full bg-[#101722] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${(ai_proposal.metrics.network_throughput_vph / maxThroughput) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#293548] text-[10px] text-[#94A3B8] flex justify-between">
          <span>Total corridor throughput</span>
          <span className="text-emerald-400 font-semibold">Higher is better</span>
        </div>
      </div>
    </div>
  );
};
