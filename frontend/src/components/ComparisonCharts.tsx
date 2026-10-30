import React from 'react';
import type { ComparisonReport } from '../types/traffic';
import { Clock, AlertOctagon, TrendingDown, Gauge } from 'lucide-react';

interface ComparisonChartsProps {
  report: ComparisonReport | null;
}

export const ComparisonCharts: React.FC<ComparisonChartsProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-8 text-center text-xs text-[#667085]">
        Run the simulation to generate comparative charts.
      </div>
    );
  }

  const { baseline, human_proposal, ai_proposal } = report;

  // Chart 1: Average Delay (s/veh)
  const maxDelay = Math.max(
    baseline.metrics.avg_vehicle_delay_sec,
    human_proposal.metrics.avg_vehicle_delay_sec,
    ai_proposal.metrics.avg_vehicle_delay_sec,
    10.0
  );

  // Chart 2: Maximum Queue Length (m)
  const maxQueue = Math.max(
    baseline.metrics.max_queue_length_m,
    human_proposal.metrics.max_queue_length_m,
    ai_proposal.metrics.max_queue_length_m,
    50.0
  );

  // Chart 3: Total Network Delay (veh-hours)
  const maxTotDelay = Math.max(
    baseline.metrics.total_network_delay_veh_hours,
    human_proposal.metrics.total_network_delay_veh_hours,
    ai_proposal.metrics.total_network_delay_veh_hours,
    1.0
  );

  // Chart 4: Network Throughput (vph)
  const maxThroughput = Math.max(
    baseline.metrics.network_throughput_vph,
    human_proposal.metrics.network_throughput_vph,
    ai_proposal.metrics.network_throughput_vph,
    100.0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Chart 1: Average Vehicle Delay */}
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2421]">
            <Clock className="w-4 h-4 text-[#1B4332]" />
            <span>Average Vehicle Delay</span>
          </div>
          <p className="text-[10px] text-[#667085] mt-0.5">Seconds delay / vehicle (lower is better)</p>
        </div>

        <div className="space-y-2.5 mt-3">
          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#667085]">Baseline Network</span>
              <span className="font-mono text-[#1F2421]">
                {baseline.metrics.avg_vehicle_delay_sec.toFixed(1)}s
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#64748B] h-full rounded-full transition-all"
                style={{
                  width: `${(baseline.metrics.avg_vehicle_delay_sec / maxDelay) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#1B4332] font-semibold">My Proposal (Human)</span>
              <span className="font-mono text-[#1B4332] font-bold">
                {human_proposal.metrics.avg_vehicle_delay_sec.toFixed(1)}s
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1B4332] h-full rounded-full transition-all"
                style={{
                  width: `${(human_proposal.metrics.avg_vehicle_delay_sec / maxDelay) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-blue-700 font-semibold">AI Alternative</span>
              <span className="font-mono text-blue-700 font-bold">
                {ai_proposal.metrics.avg_vehicle_delay_sec.toFixed(1)}s
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2563EB] h-full rounded-full transition-all"
                style={{
                  width: `${(ai_proposal.metrics.avg_vehicle_delay_sec / maxDelay) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chart 2: Maximum Queue Length */}
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2421]">
            <AlertOctagon className="w-4 h-4 text-amber-700" />
            <span>Maximum Queue Length</span>
          </div>
          <p className="text-[10px] text-[#667085] mt-0.5">Queue backlog meters (lower is better)</p>
        </div>

        <div className="space-y-2.5 mt-3">
          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#667085]">Baseline Network</span>
              <span className="font-mono text-[#1F2421]">
                {baseline.metrics.max_queue_length_m.toFixed(0)}m
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#64748B] h-full rounded-full transition-all"
                style={{
                  width: `${(baseline.metrics.max_queue_length_m / maxQueue) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#1B4332] font-semibold">My Proposal (Human)</span>
              <span className="font-mono text-[#1B4332] font-bold">
                {human_proposal.metrics.max_queue_length_m.toFixed(0)}m
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1B4332] h-full rounded-full transition-all"
                style={{
                  width: `${(human_proposal.metrics.max_queue_length_m / maxQueue) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-blue-700 font-semibold">AI Alternative</span>
              <span className="font-mono text-blue-700 font-bold">
                {ai_proposal.metrics.max_queue_length_m.toFixed(0)}m
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2563EB] h-full rounded-full transition-all"
                style={{
                  width: `${(ai_proposal.metrics.max_queue_length_m / maxQueue) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chart 3: Network Throughput */}
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2421]">
            <Gauge className="w-4 h-4 text-emerald-700" />
            <span>Network Throughput</span>
          </div>
          <p className="text-[10px] text-[#667085] mt-0.5">Vehicles served / hour (higher is better)</p>
        </div>

        <div className="space-y-2.5 mt-3">
          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#667085]">Baseline Network</span>
              <span className="font-mono text-[#1F2421]">
                {baseline.metrics.network_throughput_vph.toFixed(0)} vph
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#64748B] h-full rounded-full transition-all"
                style={{
                  width: `${(baseline.metrics.network_throughput_vph / maxThroughput) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#1B4332] font-semibold">My Proposal (Human)</span>
              <span className="font-mono text-[#1B4332] font-bold">
                {human_proposal.metrics.network_throughput_vph.toFixed(0)} vph
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1B4332] h-full rounded-full transition-all"
                style={{
                  width: `${(human_proposal.metrics.network_throughput_vph / maxThroughput) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-blue-700 font-semibold">AI Alternative</span>
              <span className="font-mono text-blue-700 font-bold">
                {ai_proposal.metrics.network_throughput_vph.toFixed(0)} vph
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2563EB] h-full rounded-full transition-all"
                style={{
                  width: `${(ai_proposal.metrics.network_throughput_vph / maxThroughput) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chart 4: Total Network Delay */}
      <div className="bg-white border border-[#E5DEC9] rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2421]">
            <TrendingDown className="w-4 h-4 text-[#1B4332]" />
            <span>Total Vehicle-Hours Lost</span>
          </div>
          <p className="text-[10px] text-[#667085] mt-0.5">Cumulative commuter congestion cost</p>
        </div>

        <div className="space-y-2.5 mt-3">
          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#667085]">Baseline Network</span>
              <span className="font-mono text-[#1F2421]">
                {baseline.metrics.total_network_delay_veh_hours.toFixed(1)} hrs
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#64748B] h-full rounded-full transition-all"
                style={{
                  width: `${
                    (baseline.metrics.total_network_delay_veh_hours / maxTotDelay) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-[#1B4332] font-semibold">My Proposal (Human)</span>
              <span className="font-mono text-[#1B4332] font-bold">
                {human_proposal.metrics.total_network_delay_veh_hours.toFixed(1)} hrs
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1B4332] h-full rounded-full transition-all"
                style={{
                  width: `${
                    (human_proposal.metrics.total_network_delay_veh_hours / maxTotDelay) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-medium mb-0.5">
              <span className="text-blue-700 font-semibold">AI Alternative</span>
              <span className="font-mono text-blue-700 font-bold">
                {ai_proposal.metrics.total_network_delay_veh_hours.toFixed(1)} hrs
              </span>
            </div>
            <div className="w-full bg-[#F4F0E8] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2563EB] h-full rounded-full transition-all"
                style={{
                  width: `${
                    (ai_proposal.metrics.total_network_delay_veh_hours / maxTotDelay) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
