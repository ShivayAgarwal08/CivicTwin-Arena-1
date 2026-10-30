import React, { useState } from 'react';
import type {
  Proposal,
  SingleIntervention,
  InterventionType,
  NetworkLink,
  NetworkNode,
} from '../types/traffic';
import { Plus, Trash2, Wrench, IndianRupee, HelpCircle, Check, Sparkles, Sliders } from 'lucide-react';

interface ProposalBuilderProps {
  proposal: Proposal;
  onChangeProposal: (p: Proposal) => void;
  links: NetworkLink[];
  nodes: NetworkNode[];
  selectedLinkId: string | null;
  onSelectLink: (linkId: string) => void;
}

export const ProposalBuilder: React.FC<ProposalBuilderProps> = ({
  proposal,
  onChangeProposal,
  links,
  nodes,
  selectedLinkId,
  onSelectLink,
}) => {
  const [targetLinkId, setTargetLinkId] = useState<string>(
    selectedLinkId || (links[0] ? links[0].id : '')
  );
  const [selectedType, setSelectedType] = useState<InterventionType>('PICKUP_BAY');
  const [extraLanes, setExtraLanes] = useState<number>(1);
  const [greenDelta, setGreenDelta] = useState<number>(15);
  const [frictionRecovery, setFrictionRecovery] = useState<number>(45);

  React.useEffect(() => {
    if (selectedLinkId) {
      setTargetLinkId(selectedLinkId);
    }
  }, [selectedLinkId]);

  const handleAddIntervention = () => {
    let cost = 850000.0;
    let params: Record<string, any> = {};
    let rationale = '';
    const linkObj = links.find((l) => l.id === targetLinkId);
    const linkName = linkObj ? linkObj.name : targetLinkId;

    if (selectedType === 'PICKUP_BAY') {
      cost = 850000.0;
      params = { friction_recovery_pct: frictionRecovery / 100.0 };
      rationale = `Construct dedicated indented drop-off bay on ${linkName} to eliminate curbside double-parking friction.`;
    } else if (selectedType === 'ROAD_CLOSURE') {
      cost = 150000.0;
      params = {};
      rationale = `Close ${linkName} to motorized through traffic, diverting trips to alternate routes.`;
    } else if (selectedType === 'ADD_LANE') {
      const len = linkObj ? linkObj.length_m : 400.0;
      cost = len * 12000.0 * extraLanes;
      params = { extra_lanes: extraLanes };
      rationale = `Widen ${linkName} by +${extraLanes} lane(s) over ${len.toFixed(0)}m length.`;
    } else if (selectedType === 'SIGNAL_RETIMING') {
      cost = 120000.0;
      const toNode = linkObj ? linkObj.to_node : (nodes[0] ? nodes[0].id : 'node_1');
      params = { green_split_delta: greenDelta / 100.0 };
      rationale = `Reallocate +${greenDelta}% green signal time to the inbound approach.`;
      const newInterv: SingleIntervention = {
        intervention_type: selectedType,
        target_link_ids: [targetLinkId],
        target_node_id: toNode,
        parameters: params,
        estimated_cost_inr: cost,
        rationale,
      };
      onChangeProposal({
        ...proposal,
        interventions: [...proposal.interventions, newInterv],
      });
      return;
    }

    const newIntervention: SingleIntervention = {
      intervention_type: selectedType,
      target_link_ids: [targetLinkId],
      parameters: params,
      estimated_cost_inr: cost,
      rationale,
    };

    onChangeProposal({
      ...proposal,
      interventions: [...proposal.interventions, newIntervention],
    });
  };

  const handleRemoveIntervention = (index: number) => {
    const updated = [...proposal.interventions];
    updated.splice(index, 1);
    onChangeProposal({
      ...proposal,
      interventions: updated,
    });
  };

  const totalCostLakhs =
    proposal.interventions.reduce((sum, i) => sum + i.estimated_cost_inr, 0) / 100000.0;

  return (
    <div className="bg-[#151D29] border border-[#293548] rounded-xl p-3.5 space-y-3.5 shadow-md text-[#E8EDF4]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#293548] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            B
          </div>
          <div>
            <h3 className="font-bold text-[#E8EDF4] text-xs flex items-center gap-1.5">
              <span>Human Proposal</span>
              <span className="text-[10px] text-[#94A3B8] font-normal">(User Defined)</span>
            </h3>
          </div>
        </div>
        <span className="text-[10px] font-bold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded">
          ₹{totalCostLakhs.toFixed(1)} Lakhs Est.
        </span>
      </div>

      {/* Title & Description Form */}
      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-semibold text-[#94A3B8] block mb-1">
            Proposal Title
          </label>
          <input
            type="text"
            value={proposal.title}
            onChange={(e) => onChangeProposal({ ...proposal, title: e.target.value })}
            className="w-full text-xs font-medium bg-[#101722] border border-[#293548] rounded-lg p-2 text-[#E8EDF4] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Add New Intervention Section */}
      <div className="bg-[#101722] border border-[#293548] rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1">
            <Wrench className="w-3 h-3 text-emerald-400" />
            <span>Add Engineering Action</span>
          </span>
        </div>

        {/* Target Road Selector */}
        <div>
          <label className="text-[10px] text-[#94A3B8] block mb-1">Target Road / Corridor Link</label>
          <select
            value={targetLinkId}
            onChange={(e) => {
              setTargetLinkId(e.target.value);
              onSelectLink(e.target.value);
            }}
            className="w-full text-xs bg-[#151D29] border border-[#293548] rounded-md p-1.5 text-[#E8EDF4] focus:outline-none focus:border-blue-500"
          >
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.length_m.toFixed(0)}m, {l.lanes} lanes)
              </option>
            ))}
          </select>
        </div>

        {/* Intervention Type Tabs */}
        <div>
          <label className="text-[10px] text-[#94A3B8] block mb-1">Intervention Type</label>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setSelectedType('PICKUP_BAY')}
              className={`p-1.5 rounded text-[11px] font-medium border text-left transition-all ${
                selectedType === 'PICKUP_BAY'
                  ? 'bg-blue-950/70 border-blue-500 text-blue-300'
                  : 'bg-[#151D29] border-[#293548] text-[#94A3B8] hover:text-[#E8EDF4]'
              }`}
            >
              Curbside Bay
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('SIGNAL_RETIMING')}
              className={`p-1.5 rounded text-[11px] font-medium border text-left transition-all ${
                selectedType === 'SIGNAL_RETIMING'
                  ? 'bg-blue-950/70 border-blue-500 text-blue-300'
                  : 'bg-[#151D29] border-[#293548] text-[#94A3B8] hover:text-[#E8EDF4]'
              }`}
            >
              Signal Retime
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('ADD_LANE')}
              className={`p-1.5 rounded text-[11px] font-medium border text-left transition-all ${
                selectedType === 'ADD_LANE'
                  ? 'bg-blue-950/70 border-blue-500 text-blue-300'
                  : 'bg-[#151D29] border-[#293548] text-[#94A3B8] hover:text-[#E8EDF4]'
              }`}
            >
              Add Lane
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('ROAD_CLOSURE')}
              className={`p-1.5 rounded text-[11px] font-medium border text-left transition-all ${
                selectedType === 'ROAD_CLOSURE'
                  ? 'bg-blue-950/70 border-blue-500 text-blue-300'
                  : 'bg-[#151D29] border-[#293548] text-[#94A3B8] hover:text-[#E8EDF4]'
              }`}
            >
              Road Closure
            </button>
          </div>
        </div>

        {/* Dynamic Parameter Adjusters */}
        {selectedType === 'PICKUP_BAY' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>Friction Capacity Recovery:</span>
              <strong className="text-emerald-400">+{frictionRecovery}%</strong>
            </div>
            <input
              type="range"
              min="15"
              max="70"
              value={frictionRecovery}
              onChange={(e) => setFrictionRecovery(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        )}

        {selectedType === 'SIGNAL_RETIMING' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>Green Phase Split Delta:</span>
              <strong className="text-emerald-400">+{greenDelta}% Green</strong>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              value={greenDelta}
              onChange={(e) => setGreenDelta(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>
        )}

        {selectedType === 'ADD_LANE' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[#94A3B8]">
              <span>Additional Carriageway Lanes:</span>
              <strong className="text-blue-400">+{extraLanes} Lane</strong>
            </div>
            <input
              type="range"
              min="1"
              max="2"
              value={extraLanes}
              onChange={(e) => setExtraLanes(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleAddIntervention}
          className="w-full mt-1 flex items-center justify-center gap-1.5 bg-[#1C2634] hover:bg-blue-600 border border-[#293548] hover:border-blue-500 text-white py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add to Human Alternative</span>
        </button>
      </div>

      {/* Configured Actions List */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
          Configured Actions ({proposal.interventions.length})
        </span>

        {proposal.interventions.length === 0 ? (
          <div className="text-center py-3 bg-[#101722] border border-dashed border-[#293548] rounded-lg text-[11px] text-[#64748B]">
            No interventions added yet.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {proposal.interventions.map((intv, idx) => (
              <div
                key={idx}
                className="bg-[#101722] border border-[#293548] rounded-lg p-2 flex items-start justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-blue-400 text-[11px]">
                      {intv.intervention_type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">
                      ₹{(intv.estimated_cost_inr / 100000).toFixed(1)}L
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] leading-tight">{intv.rationale}</p>
                </div>
                <button
                  onClick={() => handleRemoveIntervention(idx)}
                  className="text-[#64748B] hover:text-red-400 p-1 transition-colors cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
