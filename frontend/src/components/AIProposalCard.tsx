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
      className={`border rounded-xl p-4 shadow-sm space-y-3 transition-all ${
        isActive
          ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20'
          : 'bg-white border-[#E5DEC9]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold">
            C
          </div>
          <div>
            <h3 className="font-bold text-[#1F2421] text-sm flex items-center gap-1.5">
              <span>AI Proposal (Independent Alternative)</span>
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            </h3>
          </div>
        </div>
        {aiProposal && (
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
            ₹{totalCostLakhs.toFixed(1)} Lakhs Est.
          </span>
        )}
      </div>

      {!aiProposal ? (
        <div className="text-center py-4 space-y-3">
          <p className="text-xs text-[#667085]">
            The AI analyzes the network topology, queue spillover dynamics, and your objective to formulate a distinct, model-justified alternative.
          </p>
          <button
            onClick={onGenerateAIProposal}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white py-2 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Bot className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Analyzing Network Topology...' : 'Generate AI Proposal'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <h4 className="font-bold text-[#1F2421] text-xs">{aiProposal.title}</h4>
            <p className="text-xs text-[#667085] mt-1 leading-relaxed">{aiProposal.description}</p>
          </div>

          {/* AI Rationale Box */}
          {aiProposal.ai_rationale && (
            <div className="bg-[#F8FAFC] border border-blue-100 p-2.5 rounded-lg text-xs">
              <span className="font-bold text-blue-900 block text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>AI Engineering Rationale</span>
              </span>
              <p className="text-[#334155] text-[11px] leading-relaxed">
                {aiProposal.ai_rationale}
              </p>
            </div>
          )}

          {/* Stated Trade-offs */}
          {aiProposal.trade_off_notes && (
            <div className="bg-amber-50/70 border border-amber-200 p-2 rounded-lg text-[11px] text-amber-900 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Trade-off Acknowledged: </span>
                <span>{aiProposal.trade_off_notes}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onSelectAlternative}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
              }`}
            >
              {isActive ? 'Currently Viewing on Map' : 'View AI Alternative on Map'}
            </button>
            <button
              onClick={onGenerateAIProposal}
              disabled={isGenerating}
              className="px-2.5 py-1.5 border border-[#E5DEC9] hover:bg-[#F4F0E8] rounded-lg text-xs text-[#667085]"
              title="Regenerate alternative candidate"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
