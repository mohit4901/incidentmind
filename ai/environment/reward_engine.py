"""
IncidentMind Reward Engine — Composable Rubric System
Aligned with OpenEnv 2026 Standards.

This engine decomposes the reward signal into four distinct rubrics:
1. Forensic Observation Rubric (Dense)
2. Reasoning & Grounding Rubric (Dense)
3. Remediation & Success Rubric (Sparse/Terminal)
4. Operational Efficiency Rubric (Continuous)
"""

import re
import json

# Signals for 20+ incident types
ROOT_CAUSE_SIGNALS = {
    "oom_kill_cascade": ["memory", "oom", "heap", "allocation", "cache", "leak"],
    "db_connection_pool": ["connection", "pool", "exhausted", "timeout", "postgres", "db"],
    "bad_deploy_latency": ["latency", "slow", "n+1", "query", "performance", "deploy"],
    "certificate_expiry": ["certificate", "ssl", "tls", "cert", "expiry", "https"],
    "disk_saturation": ["disk", "space", "enospc", "full", "log", "storage"],
    "dns_misconfiguration": ["dns", "resolve", "nxdomain", "nameserver", "lookup"],
    "dependency_timeout": ["timeout", "upstream", "dependency", "circuit", "breaker"],
    "cpu_spike_cascade": ["cpu", "throttle", "spike", "process", "load"],
    "secret_rotation_failure": ["secret", "token", "auth", "credential", "rotation", "expired"],
    "ingress_misconfiguration": ["ingress", "nginx", "routing", "502", "upstream", "proxy"],
    "rate_limit_misconfiguration": ["rate", "limit", "throttle", "429", "quota"],
    "thundering_herd": ["cache", "miss", "stampede", "thundering", "cold", "herd"],
    "config_drift": ["config", "environment", "variable", "mismatch", "drift"],
    "autoscaler_failure": ["autoscaler", "hpa", "scale", "replicas", "metrics-server"],
    "noisy_neighbour": ["node", "neighbour", "cpu", "steal", "throttle", "cgroup"],
    "memory_leak_slow": ["memory", "leak", "rss", "heap", "growing", "gradual"],
    "network_partition": ["network", "partition", "unreachable", "split", "connectivity"],
    "job_queue_backup": ["queue", "job", "worker", "backlog", "consumer", "lag"],
    "storage_class_mismatch": ["storage", "pvc", "volume", "class", "provision"],
    "replica_sync_lag": ["replica", "lag", "sync", "replication", "primary", "standby"]
}

class RewardEngine:
    def __init__(self):
        # Weights for Rubric Composition
        self.weights = {
            "forensic": 0.4,       # Information Gathering
            "reasoning": 0.2,      # Grounded Thought
            "remediation": 0.3,    # Resolution Success
            "efficiency": 0.1      # Speed/SLA
        }

    def calculate_reward(self, env_state: dict, action: str, **kwargs) -> float:
        """
        Main Reward Entry Point (Composed Signal)
        """
        # Rubric 1: Forensic Signal (+dense)
        forensic_val = self._forensic_rubric(env_state, action, **kwargs)
        
        # Rubric 2: Reasoning Signal (+dense)
        # Assuming reasoning is passed in kwargs for the trainer
        reasoning_val = self._reasoning_rubric(kwargs.get('reasoning', ''))
        
        # Rubric 3: Remediation Signal (+sparse)
        remediation_val = 0.0
        if action == "mark_resolved":
            remediation_val = self._remediation_rubric(env_state)
            
        # Rubric 4: Efficiency Signal (-penalty)
        efficiency_val = self._efficiency_rubric(env_state)

        # Anti-Hallucination Guard (The 'Truth' Tenet)
        hallucination_penalty = self._hallucination_gate(env_state, action, kwargs)
        
        total = (
            (forensic_val * self.weights["forensic"]) +
            (reasoning_val * self.weights["reasoning"]) +
            (remediation_val * self.weights["remediation"]) +
            (efficiency_val * self.weights["efficiency"])
        )
        
        return round(float(total + hallucination_penalty), 3)

    def _forensic_rubric(self, state: dict, action: str, **kwargs) -> float:
        """Calculates Information Gain based on telemetry targeting."""
        target_service = state.get('_true_affected_service', '').lower()
        reward = 0.0
        
        if action in ["query_logs", "fetch_metric", "run_kubectl"]:
            target = str(kwargs.get('service') or kwargs.get('target') or kwargs.get('metric_name', '')).lower()
            if target_service in target or target in target_service:
                reward += 1.0 # High-signal detection
                
            # Bonus for relevant filters
            cls = state.get('_incident_class', '')
            signals = ROOT_CAUSE_SIGNALS.get(cls, [])
            filter_text = str(kwargs.get('filter_text', '')).lower()
            if any(s in filter_text for s in signals):
                reward += 0.5
        return reward

    def _reasoning_rubric(self, reasoning: str) -> float:
        """Rewards grounded chain-of-thought analysis."""
        if not reasoning: return 0.0
        reward = 0.1 # Base reward for attempt
        
        logical_anchors = ["observed", "because", "indicated", "therefore", "hypothesis"]
        matches = sum(1 for anchor in logical_anchors if anchor in reasoning.lower())
        reward += min(0.4, matches * 0.1)
        
        if len(reasoning) > 100: reward += 0.1
        return reward

    def _remediation_rubric(self, state: dict) -> float:
        """Sparse reward for successful resolution."""
        if state.get('_correct_fix_applied'):
            return 10.0
        return -5.0 # Wrong resolution penalty

    def _efficiency_rubric(self, state: dict) -> float:
        """Encourages fast resolution relative to SLA."""
        time_elapsed = state.get('time_elapsed', 0)
        sla = state.get('sla_minutes', 30)
        decay = (time_elapsed / sla)
        return -1.0 * decay # Scale from 0 to -1.0

    def _hallucination_gate(self, state: dict, action: str, kwargs: dict) -> float:
        """The 'Source of Truth' check."""
        target = str(kwargs.get('service') or kwargs.get('target') or '').lower()
        if not target: return 0.0
        
        # Valid entities from environment state
        valid_services = ["api-gateway", "checkout", "postgres", "payment", "inventory"]
        valid_pods = list(state.get('pod_status', {}).keys())
        
        if target not in [v.lower() for v in valid_services] and target not in [v.lower() for v in valid_pods]:
            if "execute_fix" in action or "query_logs" in action:
                print(f"[HALLUCINATION] Target {target} not in state.")
                return -5.0 # HEAVY penalty for hallucinating infrastructure
        return 0.0

    # Academic Reporting Methods (For Dashboard)
    def calculate_academic_metrics(self, history: list) -> dict:
        if not history:
            return {"precision": 0.0, "f1_score": 0.0, "accuracy": 0.0}
            
        tp = sum(1 for e in history if e.get('reward', 0) > 0.5)
        fp = sum(1 for e in history if e.get('reward', 0) < 0)
        total = len(history)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        accuracy = tp / total if total > 0 else 0.0
        f1 = (2 * precision * accuracy) / (precision + accuracy) if (precision + accuracy) > 0 else 0.0
        
        return {
            "precision": round(precision, 2),
            "f1_score": round(f1, 2),
            "accuracy": round(accuracy, 2)
        }

    def calculate_seniority_report(self, reward, steps, resolved, correct_fix) -> dict:
        base_score = 50.0 if resolved else 0.0
        efficiency = max(0, 30.0 * (1.0 - (steps / 50.0)))
        total = base_score + (20.0 if correct_fix else 0.0) + efficiency
        
        return {
            "seniority_score": round(total, 1),
            "revenue_impact_usd": int((30 - steps) * 10000) if resolved else -500000,
            "ranking": "Principal SRE" if total > 85 else "Senior SRE" if total > 60 else "Intern"
        }
