from typing import Dict, List, Tuple
from ..models.schemas import SpilloverClassification, LinkPerformanceResult


class SpilloverAnalyzer:
    """
    Classifies and explains secondary and indirect impacts on network links
    that were not directly modified by an intervention.
    """

    @staticmethod
    def analyze_link_spillover(
        link_id: str,
        baseline_res: LinkPerformanceResult,
        proposal_res: LinkPerformanceResult,
        is_directly_modified: bool,
    ) -> Tuple[SpilloverClassification, float, str]:
        """
        Returns (SpilloverClassification, delta_delay_sec, explanation_string).
        """
        delta_delay = proposal_res.delay_sec_per_veh - baseline_res.delay_sec_per_veh
        base_delay = max(2.0, baseline_res.delay_sec_per_veh)
        pct_change = (delta_delay / base_delay) * 100.0

        base_vc = baseline_res.vc_ratio
        prop_vc = proposal_res.vc_ratio

        if is_directly_modified:
            # Directly intervened link: not a spillover
            return (
                SpilloverClassification.NEUTRAL,
                round(delta_delay, 1),
                "Directly intervened segment (primary intervention applied).",
            )

        # Condition 1: Newly Congested Link
        # Previously uncongested (V/C < 0.85) that has now transitioned into oversaturation (V/C >= 0.95)
        if base_vc < 0.85 and prop_vc >= 0.95:
            return (
                SpilloverClassification.NEWLY_CONGESTED,
                round(delta_delay, 1),
                f"Severe Spillover: Traffic diversion induced bottleneck on this surrounding link. V/C jumped from {base_vc:.2f} to {prop_vc:.2f} (+{delta_delay:.1f}s delay/veh).",
            )

        # Condition 2: Deteriorated
        # Significant delay increase (> 20% increase and at least 6s added delay)
        if pct_change > 20.0 and delta_delay >= 5.0:
            return (
                SpilloverClassification.DETERIORATED,
                round(delta_delay, 1),
                f"Deteriorated: Flow displacement increased queueing delay by +{pct_change:.0f}% (+{delta_delay:.1f}s) due to diverted vehicles.",
            )

        # Condition 3: Moderate Increase
        # Noticeable delay increase (+5% to +20%)
        if pct_change >= 5.0 and delta_delay >= 2.0:
            return (
                SpilloverClassification.MODERATE,
                round(delta_delay, 1),
                f"Moderate Spillover: Mild vehicle spillover added +{delta_delay:.1f}s delay/veh (+{pct_change:.0f}%).",
            )

        # Condition 4: Improved
        # Delay decreased on this surrounding link by >= 10%
        if pct_change <= -10.0 and delta_delay <= -2.0:
            return (
                SpilloverClassification.IMPROVED,
                round(delta_delay, 1),
                f"Positive Spillover: Relieved bottleneck downstream diverted traffic smoothly, reducing link delay by {abs(pct_change):.0f}% ({delta_delay:.1f}s).",
            )

        # Condition 5: Neutral
        return (
            SpilloverClassification.NEUTRAL,
            round(delta_delay, 1),
            f"Neutral: Operational flow maintained within baseline equilibrium (delta {delta_delay:+.1f}s).",
        )
