import React from 'react';
import type { Proposal } from '../types/traffic';
import { Sparkles, Bot, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface AIProposalCardProps {
  aiProposal: Proposal | null;
  onGenerateAIProposal: () => void;
  isGenerating: boolean;
  onSelectAlternative: () => void;
  isActive: boolean;
}

export const AIProposalCard: React.FC<AIProposalCardProps> = ({
  aiProposal,
  onGenerateAIProposal,
  isGenerating,
  onSelectAlternative,
  isActive,
}) => {
  const totalCostLakhs = aiProposal
    ? aiProposal.interventions.reduce((sum, i) => sum + i.estimated_cost_inr, 0) / 100000.0
    : 0.0;

  return (
    <div
      className={`border rounded-xl p-3.5 shadow-md space-y-3 transition-all ${
        isActive
          ? 'bg-[#151D29] border-purple-500/70 ring-1 ring-purple-500/30'
          : 'bg-[#151D29] border-[#293548]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#293548] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
            C
          </div>
          <div>
            <h3 className="font-bold text-[#E8EDF4] text-xs flex items-center gap-1.5">
              <span>AI Proposal</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </h3>
          </div>
        </div>
        {aiProposal && (
          <span className="text-[10px] font-bold text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded">
            ₹{totalCostLakhs.toFixed(1)} Lakhs Est.
          </span>
        )}
      </div>

      {!aiProposal ? (
        <div className="text-center py-3 space-y-2.5">
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            The AI analyzes corridor topology, queue spillover dynamics, and the objective to formulate an independent, model-justified alternative.
          </p>
          <button
            onClick={onGenerateAIProposal}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white py-2 px-3 rounded-lg text-xs font-semibold shadow-md shadow-purple-950/40 transition-all cursor-pointer"
          >
            <Bot className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Analyzing Network Topology...' : 'Generate AI Proposal'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div>
            <h4 className="font-bold text-[#E8EDF4] text-xs">{aiProposal.title}</h4>
            <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed">{aiProposal.description}</p>
          </div>

          {/* AI Rationale Box */}
          {aiProposal.ai_rationale && (
            <div className="bg-[#101722] border border-purple-900/40 p-2.5 rounded-lg text-xs">
              <span className="font-bold text-purple-300 block text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>AI Engineering Rationale</span>
              </span>
              <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                {aiProposal.ai_rationale}
              </p>
            </div>
          )}

          {/* Interventions in AI Proposal */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              Formulated Actions ({aiProposal.interventions.length})
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {aiProposal.interventions.map((intv, idx) => (
                <div
                  key={idx}
                  className="bg-[#101722] border border-[#293548] rounded-md p-2 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-purple-300">
                      {intv.intervention_type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">
                      ₹{(intv.estimated_cost_inr / 100000).toFixed(1)}L
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">{intv.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={onSelectAlternative}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-[#101722] border-[#293548] text-[#94A3B8] hover:text-[#E8EDF4]'
              }`}
            >
              <ArrowRight className="w-3 h-3" />
              <span>{isActive ? 'Viewing on Map' : 'Inspect AI on Map'}</span>
            </button>
            <button
              onClick={onGenerateAIProposal}
              disabled={isGenerating}
              className="p-1.5 rounded-lg border border-[#293548] bg-[#101722] text-[#94A3B8] hover:text-[#E8EDF4] transition-colors cursor-pointer"
              title="Regenerate alternative"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
