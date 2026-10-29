import React, { useState } from 'react';
import type {
  Proposal,
  SingleIntervention,
  InterventionType,
  NetworkLink,
  NetworkNode,
} from '../types/traffic';
import { Plus, Trash2, Wrench, IndianRupee, HelpCircle, Check, Sparkles } from 'lucide-react';

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

  // Sync if selectedLinkId changes externally from map
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
      cost = 850000.0; // 8.5 Lakhs
      params = { friction_recovery_pct: frictionRecovery / 100.0 };
      rationale = `Construct dedicated indented drop-off bay on ${linkName} to eliminate curbside double-parking friction.`;
    } else if (selectedType === 'ADD_LANE') {
      const len = linkObj ? linkObj.length_m : 400.0;
      cost = len * 12000.0 * extraLanes; // 12k/meter per lane
      params = { extra_lanes: extraLanes };
      rationale = `Widen ${linkName} by +${extraLanes} lane(s) over ${len.toFixed(0)}m length.`;
    } else if (selectedType === 'SIGNAL_RETIMING') {
      cost = 120000.0; // 1.2 Lakhs
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
    } else if (selectedType === 'ONE_WAY_DIVERSION') {
      cost = 250000.0;
      params = {};
      rationale = `Convert ${linkName} into a one-way channelized corridor to eliminate turning conflicts.`;
    } else if (selectedType === 'TRAFFIC_CALMING') {
      cost = 350000.0;
      params = { speed_reduction_kmh: 15.0 };
      rationale = `Install raised speed tables on ${linkName} to deter neighborhood cut-through rat running.`;
    } else if (selectedType === 'MEDIAN_CLOSURE') {
      cost = 180000.0;
      params = {};
      rationale = `Seal uncontrolled median right-turn opening on ${linkName}.`;
    }

    const newInterv: SingleIntervention = {
      intervention_type: selectedType,
      target_link_ids: [targetLinkId],
      parameters: params,
      estimated_cost_inr: cost,
      rationale,
    };

    onChangeProposal({
      ...proposal,
      interventions: [...proposal.interventions, newInterv],
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
    <div className="bg-white border border-[#E5DEC9] rounded-xl p-4 shadow-sm space-y-4">
      {/* Title & Description */}
      <div className="border-b border-[#E5DEC9] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1B4332] text-white flex items-center justify-center text-xs font-bold">
              B
            </div>
            <h3 className="font-bold text-[#1F2421] text-sm">My Proposal (Human Alternative)</h3>
          </div>
          <span className="text-[11px] font-semibold text-[#1B4332] bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#C8E6C9]">
            ₹{totalCostLakhs.toFixed(1)} Lakhs Est.
          </span>
        </div>
        <p className="text-xs text-[#667085] mt-1">
          Select a road on the map, choose a physical or operational intervention, and inspect predicted results.
        </p>
      </div>

      {/* Intervention Selector Form */}
      <div className="space-y-3 bg-[#FBF9F5] p-3 rounded-lg border border-[#E5DEC9]">
        <div>
          <label className="block text-[11px] font-semibold text-[#1F2421] mb-1">
            Target Road Corridor
          </label>
          <select
            value={targetLinkId}
            onChange={(e) => {
              setTargetLinkId(e.target.value);
              onSelectLink(e.target.value);
            }}
            className="w-full text-xs bg-white border border-[#E5DEC9] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#1B4332] text-[#1F2421]"
          >
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.lanes} lanes, {l.highway_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#1F2421] mb-1">
            Intervention Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as InterventionType)}
            className="w-full text-xs bg-white border border-[#E5DEC9] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#1B4332] text-[#1F2421]"
          >
            <option value="PICKUP_BAY">Dedicated Curbside Pick-up / Drop-off Bay (Campus/Transit)</option>
            <option value="ADD_LANE">Add Travel Lane / Road Widening</option>
            <option value="SIGNAL_RETIMING">Intersection Signal Green Phase Re-timing</option>
            <option value="ONE_WAY_DIVERSION">One-Way Reversal & Channelization</option>
            <option value="TRAFFIC_CALMING">Traffic Calming (Neighborhood Protection)</option>
            <option value="MEDIAN_CLOSURE">Median Gap Closure (U-turn Relocation)</option>
          </select>
        </div>

        {/* Dynamic Parameter Sliders */}
        {selectedType === 'PICKUP_BAY' && (
          <div>
            <div className="flex justify-between text-[11px] text-[#667085] mb-1">
              <span>Curbside Friction Recovery</span>
              <span className="font-semibold text-[#1F2421]">+{frictionRecovery}% Capacity</span>
            </div>
            <input
              type="range"
              min="20"
              max="60"
              value={frictionRecovery}
              onChange={(e) => setFrictionRecovery(Number(e.target.value))}
              className="w-full accent-[#1B4332]"
            />
            <p className="text-[10px] text-[#667085] mt-0.5">
              Replaces curbside parent/cab double-parking with dedicated 60m indented boarding bay.
            </p>
          </div>
        )}

        {selectedType === 'ADD_LANE' && (
          <div>
            <div className="flex justify-between text-[11px] text-[#667085] mb-1">
              <span>Additional Travel Lanes</span>
              <span className="font-semibold text-[#1F2421]">+{extraLanes} lane ({extraLanes * 1100} vph)</span>
            </div>
            <input
              type="range"
              min="1"
              max="2"
              value={extraLanes}
              onChange={(e) => setExtraLanes(Number(e.target.value))}
              className="w-full accent-[#1B4332]"
            />
          </div>
        )}

        {selectedType === 'SIGNAL_RETIMING' && (
          <div>
            <div className="flex justify-between text-[11px] text-[#667085] mb-1">
              <span>Green Phase Time Adjustment</span>
              <span className="font-semibold text-[#1F2421]">+{greenDelta}% Green</span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              value={greenDelta}
              onChange={(e) => setGreenDelta(Number(e.target.value))}
              className="w-full accent-[#1B4332]"
            />
          </div>
        )}

        <button
          onClick={handleAddIntervention}
          className="w-full flex items-center justify-center gap-1.5 bg-[#1B4332] hover:bg-[#143225] text-white py-2 px-3 rounded-md text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Intervention to My Proposal</span>
        </button>
      </div>

      {/* Applied Interventions List */}
      <div>
        <h4 className="text-xs font-bold text-[#1F2421] mb-2 flex items-center justify-between">
          <span>Configured Interventions ({proposal.interventions.length})</span>
          {proposal.interventions.length === 0 && (
            <span className="text-[11px] font-normal text-[#667085] italic">No changes added yet</span>
          )}
        </h4>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {proposal.interventions.map((item, idx) => {
            const costLakhs = item.estimated_cost_inr / 100000.0;
            return (
              <div
                key={idx}
                className="flex items-start justify-between bg-[#F4F0E8] border border-[#E5DEC9] p-2 rounded-lg text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-[#1F2421]">
                    <span className="w-2 h-2 rounded-full bg-[#1B4332]"></span>
                    <span>{item.intervention_type.replace('_', ' ')}</span>
                    <span className="text-[10px] text-[#667085] font-normal">
                      (₹{costLakhs.toFixed(1)}L)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#667085] mt-0.5">{item.rationale}</p>
                </div>
                <button
                  onClick={() => handleRemoveIntervention(idx)}
                  className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-white transition-all ml-2"
                  title="Remove intervention"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
