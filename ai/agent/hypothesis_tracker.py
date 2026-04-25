"""
Hypothesis Tracker — tracks the agent's evolving beliefs about root cause.
Used for reward computation and debugging agent reasoning.
"""


class HypothesisTracker:
    def __init__(self):
        self.hypotheses = []
        self.confidence_history = []
    
    def add(self, hypothesis: str, confidence: float, step: int):
        self.hypotheses.append({
            "step": step,
            "text": hypothesis,
            "confidence": confidence,
        })
        self.confidence_history.append(confidence)
    
    def get_latest(self) -> dict:
        if not self.hypotheses:
            return {}
        return self.hypotheses[-1]
    
    def get_highest_confidence(self) -> dict:
        if not self.hypotheses:
            return {}
        return max(self.hypotheses, key=lambda h: h["confidence"])
    
    def get_all(self) -> list[dict]:
        return self.hypotheses
    
    def confidence_trend(self) -> str:
        """Returns 'increasing', 'decreasing', or 'flat'."""
        if len(self.confidence_history) < 2:
            return "flat"
        diffs = [
            self.confidence_history[i+1] - self.confidence_history[i]
            for i in range(len(self.confidence_history) - 1)
        ]
        avg_diff = sum(diffs) / len(diffs)
        if avg_diff > 0.05:
            return "increasing"
        elif avg_diff < -0.05:
            return "decreasing"
        return "flat"
    
    def reset(self):
        self.hypotheses = []
        self.confidence_history = []
