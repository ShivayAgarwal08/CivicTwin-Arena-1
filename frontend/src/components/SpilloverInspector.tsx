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
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-8 text-center text-xs text-[#94A3B8]">
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
          <span className="bg-red-950/80 text-red-400 border border-red-800/80 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
            Newly Congested (V/C &ge; 0.95)
          </span>
        );
      case 'deteriorated':
        return (
          <span className="bg-amber-950/80 text-amber-400 border border-amber-800/80 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
            Deteriorated (+20% Delay)
          </span>
        );
      case 'moderate':
        return (
          <span className="bg-yellow-950/80 text-yellow-300 border border-yellow-800/80 font-medium px-2 py-0.5 rounded text-[10px] uppercase">
            Moderate (+5-20%)
          </span>
        );
      case 'improved':
        return (
          <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
            Improved (Relieved)
          </span>
        );
      case 'unaffected':
      default:
        return (
          <span className="bg-[#101722] text-[#94A3B8] border border-[#293548] font-medium px-2 py-0.5 rounded text-[10px] uppercase">
            Unaffected (&plusmn;5%)
          </span>
        );
    }
  };

  const newlyCongested = spilloverLinks.filter((l) => l.spillover_status === 'newly_congested');
  const deteriorated = spilloverLinks.filter((l) => l.spillover_status === 'deteriorated');
  const improved = spilloverLinks.filter((l) => l.spillover_status === 'improved');

  return (
    <div className="space-y-3.5">
      {/* Top Banner Explaining Spillover */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl p-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-[#E8EDF4]">Network Spillover &amp; Braess Paradox Guard</h4>
            <span className="text-[10px] font-semibold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded">
              Active: Alternative {activeAlternative}
            </span>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Interventions at one bottleneck can displace traffic onto adjacent neighborhood streets.
            CivicTwin Arena audits all un-modified links against baseline congestion levels.
          </p>
        </div>
      </div>

      {/* Metric Summary Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#151D29] border border-red-900/50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              Newly Congested
            </span>
            <div className="text-lg font-bold text-red-300">{newlyCongested.length} links</div>
            <span className="text-[10px] text-[#94A3B8]">Exceeded 95% capacity</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-400 font-bold text-xs">
            !
          </div>
        </div>

        <div className="bg-[#151D29] border border-amber-900/50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Deteriorated Delay
            </span>
            <div className="text-lg font-bold text-amber-300">{deteriorated.length} links</div>
            <span className="text-[10px] text-[#94A3B8]">&gt;20% delay jump</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400 font-bold text-xs">
            &Delta;
          </div>
        </div>

        <div className="bg-[#151D29] border border-emerald-900/50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Relieved Streets
            </span>
            <div className="text-lg font-bold text-emerald-300">{improved.length} links</div>
            <span className="text-[10px] text-[#94A3B8]">Benefited from diversion</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 font-bold text-xs">
            &check;
          </div>
        </div>
      </div>

      {/* Spillover Links List */}
      <div className="bg-[#151D29] border border-[#293548] rounded-xl overflow-hidden shadow-md">
        <div className="bg-[#101722] border-b border-[#293548] px-3.5 py-2.5 flex items-center justify-between text-xs">
          <span className="font-bold text-[#E8EDF4]">Detailed Surrounding Street Breakdown</span>
          <span className="text-[10px] text-[#94A3B8]">{spilloverLinks.length} surrounding links monitored</span>
        </div>

        <div className="divide-y divide-[#293548] max-h-56 overflow-y-auto">
          {spilloverLinks.map((link) => {
            const baseLink = baselineResults[link.link_id];
            const baseDelay = baseLink ? baseLink.delay_sec : link.delay_sec;
            const diffDelay = link.delay_sec - baseDelay;

            return (
              <div
                key={link.link_id}
                className="p-3 hover:bg-[#1C2634] transition-colors flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#E8EDF4]">{link.link_name}</span>
                    {getStatusBadge(link.spillover_status)}
                  </div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Flow: {link.assigned_flow_vph.toFixed(0)} vph | V/C: {(link.v_over_c * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-xs text-[#E8EDF4]">
                    Delay: {link.delay_sec.toFixed(1)}s
                  </div>
                  <div className="text-[10px]">
                    {diffDelay > 0.5 ? (
                      <span className="text-red-400 font-medium">+{diffDelay.toFixed(1)}s vs Base</span>
                    ) : diffDelay < -0.5 ? (
                      <span className="text-emerald-400 font-medium">{diffDelay.toFixed(1)}s vs Base</span>
                    ) : (
                      <span className="text-[#64748B]">Neutral</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
