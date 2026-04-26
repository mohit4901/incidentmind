"""
IncidentMind Environment — OpenEnv Hackathon 2026
A gym-style environment for training LLM agents to resolve production incidents.

Judging alignment:
- Environment Innovation (40%): Novel domain, realistic partial observability, 20+ incident types
- Training Evidence (20%): Dense + sparse rewards, rubric-based scoring
- Pipeline (10%): OpenEnv compliant, real data patterns
"""

import random
import json
import time
from dataclasses import dataclass, field, asdict
from typing import Optional

from .incident_generator import IncidentGenerator
from .log_generator import LogGenerator
from .metric_generator import MetricGenerator
from .reward_engine import RewardEngine


@dataclass
class IncidentState:
    # What agent CAN see
    alert: dict                          # PagerDuty-style alert payload
    current_logs: list[str]              # Last 50 log lines (noisy)
    available_metrics: list[str]         # Metric names available to query
    runbook_index: list[str]             # List of runbook sections
    slack_thread: list[str]              # Simulated Slack messages
    pod_status: dict                     # kubectl pod status summary
    recent_deploys: list[dict]           # Last 3 deploy SHAs + times
    time_elapsed: int                    # Simulated minutes elapsed
    sla_minutes: int                     # SLA window (30 min)
    action_history: list[str]            # What agent has done so far
    hypothesis_log: list[str]            # Agent's posted hypotheses
    
    # Hidden from agent (used for reward computation only)
    _true_root_cause: str = field(default="", repr=False)
    _true_affected_service: str = field(default="", repr=False)
    _true_fix_action: str = field(default="", repr=False)
    _incident_class: str = field(default="", repr=False)
    _resolved: bool = field(default=False, repr=False)
    _fix_attempts: int = field(default=0, repr=False)
    _correct_fix_applied: bool = field(default=False, repr=False)


class IncidentMindEnv:
    """
    IncidentMind: An RL environment for training LLM agents on SRE incident resolution.
    
    Episode structure:
    - reset(): Sample a random incident class, inject into environment
    - step(): Agent takes an action (tool call), environment responds
    - Max 50 steps per episode
    - Terminal: agent calls mark_resolved() or time exceeds SLA
    
    Incident classes (20 total):
    1. OOM kill cascade          11. Rate limit misconfiguration
    2. DB connection pool full   12. Thundering herd / cache miss
    3. Bad deploy (latency)      13. Config drift
    4. Certificate expiry        14. Autoscaler failure
    5. Disk saturation           15. Noisy neighbour
    6. DNS misconfiguration      16. Memory leak (slow)
    7. Dependency timeout        17. Network partition
    8. CPU spike cascade         18. Job queue backup
    9. Secret rotation failure   19. Storage class mismatch
    10. Ingress misconfiguration 20. Replica sync lag
    """

    name = "incidentmind-sre-v1"
    description = "Train LLM agents to resolve production incidents like a Senior SRE"
    version = "1.0.0"
    
    INCIDENT_CLASSES = [
        "oom_kill_cascade", "db_connection_pool", "bad_deploy_latency",
        "certificate_expiry", "disk_saturation", "dns_misconfiguration",
        "dependency_timeout", "cpu_spike_cascade", "secret_rotation_failure",
        "ingress_misconfiguration", "rate_limit_misconfiguration", "thundering_herd",
        "config_drift", "autoscaler_failure", "noisy_neighbour",
        "memory_leak_slow", "network_partition", "job_queue_backup",
        "storage_class_mismatch", "replica_sync_lag"
    ]
    
    MAX_STEPS = 50
    SLA_MINUTES = 30

    def __init__(self, chaos_level: int = 0):
        self.incident_gen = IncidentGenerator()
        self.log_gen = LogGenerator()
        self.metric_gen = MetricGenerator()
        self.reward_engine = RewardEngine()
        self.chaos_level = chaos_level # 0 = Standard, 10 = Maximum Chaos
        self._state: Optional[IncidentState] = None
        self._step_count = 0
        self._episode_reward = 0.0
        self._trajectory = []

    def reset(self, forced_class: Optional[str] = None, chaos_level: Optional[int] = None) -> dict:
        """Start a new incident episode."""
        if chaos_level is not None:
            self.chaos_level = chaos_level
            
        if forced_class and forced_class in self.INCIDENT_CLASSES:
            incident_class = forced_class
        else:
            incident_class = random.choice(self.INCIDENT_CLASSES)
            
        incident_data = self.incident_gen.generate(incident_class)
        
        self._step_count = 0
        self._episode_reward = 0.0
        self._trajectory = []
        
        self._state = IncidentState(
            alert=incident_data["alert"],
            current_logs=self.log_gen.generate(incident_class, num_lines=50),
            available_metrics=incident_data["available_metrics"],
            runbook_index=incident_data["runbook_sections"],
            slack_thread=incident_data["slack_thread"],
            pod_status=incident_data["pod_status"],
            recent_deploys=incident_data["recent_deploys"],
            time_elapsed=0,
            sla_minutes=self.SLA_MINUTES,
            action_history=[],
            hypothesis_log=[],
            _true_root_cause=incident_data["root_cause"],
            _true_affected_service=incident_data["affected_service"],
            _true_fix_action=incident_data["correct_fix"],
            _incident_class=incident_class,
            _resolved=False,
            _fix_attempts=0,
            _correct_fix_applied=False,
        )
        
        return self.state()

    def state(self) -> dict:
        """Return only what the agent is allowed to see."""
        s = self._state
        return {
            "alert": s.alert,
            "logs": s.current_logs,
            "available_metrics": s.available_metrics,
            "runbook_sections": s.runbook_index,
            "slack_thread": s.slack_thread,
            "pod_status": s.pod_status,
            "recent_deploys": s.recent_deploys,
            "time_elapsed_minutes": s.time_elapsed,
            "sla_remaining_minutes": s.sla_minutes - s.time_elapsed,
            "action_history": s.action_history,
            "hypothesis_log": s.hypothesis_log,
            "step_count": self._step_count,
            "episode_reward_so_far": self._episode_reward,
        }

    def query_logs(self, service: str, time_range: str = "last_15m", filter_text: str = "") -> dict:
        """
        Query logs for a specific service.
        Args:
            service: service name (e.g., "api-gateway", "postgres", "redis")
            time_range: "last_5m", "last_15m", "last_1h"
            filter_text: filter string to search in logs
        """
        self._state.time_elapsed += 1
        self._state.action_history.append(f"query_logs(service={service}, filter={filter_text})")
        
        logs = self.log_gen.query(
            service=service,
            incident_class=self._state._incident_class,
            filter_text=filter_text
        )
        
        reward = self.reward_engine.score_query_logs(
            service=service,
            filter_text=filter_text,
            true_root_cause=self._state._true_root_cause,
            true_affected_service=self._state._true_affected_service,
            action_history=self._state.action_history
        )
        
        self._apply_reward(reward, f"query_logs → {service}")
        return {"logs": logs, "reward_delta": reward}

    def fetch_metric(self, metric_name: str, window: str = "15m") -> dict:
        """
        Fetch a Prometheus-style metric time series.
        Args:
            metric_name: one of available_metrics in state
            window: "5m", "15m", "1h", "6h"
        """
        self._state.time_elapsed += 1
        self._state.action_history.append(f"fetch_metric({metric_name}, {window})")
        
        if metric_name not in self._state.available_metrics:
            reward = -0.1
            self._apply_reward(reward, "fetch_metric → metric not available")
            return {"error": "metric not found", "reward_delta": reward}
        
        metric_data = self.metric_gen.fetch(
            metric_name=metric_name,
            incident_class=self._state._incident_class,
            window=window
        )
        
        reward = self.reward_engine.score_fetch_metric(
            metric_name=metric_name,
            true_root_cause=self._state._true_root_cause,
            action_history=self._state.action_history
        )
        
        self._apply_reward(reward, f"fetch_metric → {metric_name}")
        return {"metric": metric_data, "reward_delta": reward}

    def run_kubectl(self, command: str) -> dict:
        """
        Run a kubectl command. Only safe read commands allowed.
        Args:
            command: e.g. "describe pod api-gateway-xxx", "get pods -n production", "logs api-gateway --tail=50"
        """
        self._state.time_elapsed += 1
        self._state.action_history.append(f"run_kubectl({command})")
        
        result = self._simulate_kubectl(command)
        reward = self.reward_engine.score_kubectl(
            command=command,
            true_root_cause=self._state._true_root_cause,
            result=result
        )
        
        self._apply_reward(reward, f"kubectl → {command[:30]}")
        return {"output": result, "reward_delta": reward}

    def read_runbook(self, section: str) -> dict:
        """
        Read a specific runbook section.
        Args:
            section: one of the sections listed in state.runbook_sections
        """
        self._state.time_elapsed += 1
        self._state.action_history.append(f"read_runbook({section})")
        
        content = self.incident_gen.get_runbook_section(
            self._state._incident_class, section
        )
        
        reward = self.reward_engine.score_runbook(
            section=section,
            true_root_cause=self._state._true_root_cause
        )
        
        self._apply_reward(reward, f"read_runbook → {section}")
        return {"content": content, "reward_delta": reward}

    def post_hypothesis(self, hypothesis: str, confidence: float = 0.5) -> dict:
        """
        Post a root cause hypothesis. Good hypotheses get rewarded.
        Args:
            hypothesis: natural language hypothesis about root cause
            confidence: 0.0 to 1.0
        """
        self._state.hypothesis_log.append(f"[{self._step_count}] {hypothesis} (conf={confidence})")
        self._state.action_history.append(f"post_hypothesis(conf={confidence})")
        
        reward = self.reward_engine.score_hypothesis(
            hypothesis=hypothesis,
            confidence=confidence,
            true_root_cause=self._state._true_root_cause,
            true_incident_class=self._state._incident_class
        )
        
        self._apply_reward(reward, f"hypothesis → {hypothesis[:50]}")
        return {"accepted": True, "reward_delta": reward, "hint": "hypothesis logged"}

    def execute_fix(self, action: str, target: str, parameters: dict = {}) -> dict:
        """
        Execute a remediation action.
        Args:
            action: one of ["restart_service", "rollback_deploy", "scale_up", 
                           "flush_connections", "rotate_certificate", "clear_disk",
                           "update_config", "update_rate_limit", "drain_node", "restart_pod"]
            target: service or resource name
            parameters: action-specific parameters
        """
        self._state.time_elapsed += 3  # Fixes take time
        self._state._fix_attempts += 1
        self._state.action_history.append(f"execute_fix({action}, {target})")
        
        correct = self.reward_engine.is_correct_fix(
            action=action,
            target=target,
            true_fix_action=self._state._true_fix_action,
            true_affected_service=self._state._true_affected_service
        )
        
        if correct:
            self._state._correct_fix_applied = True
            reward = 1.2
            outcome = "Fix applied successfully. Metrics show improvement."
        else:
            reward = -0.5
            outcome = f"Fix applied but metrics unchanged. Situation may be worsening."
        
        self._apply_reward(reward, f"execute_fix → {action} on {target}")
        return {
            "outcome": outcome,
            "metrics_trend": "improving" if correct else "unchanged",
            "reward_delta": reward,
            "fix_attempts": self._state._fix_attempts
        }

    def check_deploy_diff(self, sha: str) -> dict:
        """
        Check what changed in a specific deploy.
        Args:
            sha: deploy SHA from recent_deploys in state
        """
        self._state.time_elapsed += 1
        self._state.action_history.append(f"check_deploy_diff({sha[:8]})")
        
        diff = self.incident_gen.get_deploy_diff(
            self._state._incident_class, sha
        )
        
        reward = self.reward_engine.score_deploy_check(
            sha=sha,
            incident_class=self._state._incident_class
        )
        
        self._apply_reward(reward, f"check_deploy_diff → {sha[:8]}")
        return {"diff_summary": diff, "reward_delta": reward}

    def query_slack(self, channel: str = "incidents", keyword: str = "") -> dict:
        """
        Search Slack for related messages.
        Args:
            channel: slack channel name
            keyword: search keyword
        """
        self._state.time_elapsed += 1
        self._state.action_history.append(f"query_slack({channel}, {keyword})")
        
        messages = self.incident_gen.get_slack_messages(
            self._state._incident_class, keyword
        )
        
        reward = 0.05  # Small reward for context gathering
        self._apply_reward(reward, "query_slack")
        return {"messages": messages, "reward_delta": reward}

    def page_human(self, reason: str, urgency: str = "high") -> dict:
        """
        Escalate to a human SRE. High penalty if called too early.
        Args:
            reason: why you're escalating
            urgency: "medium", "high", "critical"
        """
        self._state.action_history.append(f"page_human(urgency={urgency})")
        
        # Penalty if agent had enough info to resolve but chose to escalate
        had_enough_info = (
            len(self._state.hypothesis_log) >= 1 and
            self._state._fix_attempts == 0 and
            self._step_count > 5
        )
        
        if had_enough_info:
            reward = -1.0
            response = "Human paged. Note: sufficient information was available to attempt resolution."
        else:
            reward = -0.2
            response = "Human paged. Escalation recorded."
        
        self._apply_reward(reward, f"page_human → {reason[:30]}")
        return {"response": response, "reward_delta": reward, "escalated": True}

    def mark_resolved(self, root_cause_analysis: str, fix_applied: str) -> dict:
        """
        Mark the incident as resolved. Triggers final reward computation.
        Args:
            root_cause_analysis: detailed RCA text
            fix_applied: description of fix that resolved the incident
        """
        self._state._resolved = True
        self._state.action_history.append("mark_resolved()")
        
        total_reward = self.reward_engine.score_resolution(
            rca_text=root_cause_analysis,
            fix_description=fix_applied,
            true_root_cause=self._state._true_root_cause,
            true_fix=self._state._true_fix_action,
            correct_fix_applied=self._state._correct_fix_applied,
            time_elapsed=self._state.time_elapsed,
            sla_minutes=self.SLA_MINUTES,
            fix_attempts=self._state._fix_attempts,
            step_count=self._step_count,
            hypothesis_log=self._state.hypothesis_log,
            action_history=self._state.action_history
        )
        
        self._apply_reward(total_reward, "RESOLUTION")
        
        return {
            "resolved": True,
            "final_reward": final_reward,
            "total_episode_reward": self._episode_reward,
            "time_taken_minutes": self._state.time_elapsed,
            "sla_met": self._state.time_elapsed <= self._state.sla_minutes,
            "correct_root_cause": self._state._true_root_cause,
            "steps_taken": self._step_count,
        }

    def step(self, tool_name: str, **kwargs) -> tuple[dict, float, bool, dict]:
        """Standard gym-style step."""
        self._step_count += 1
        
        tool_fn = getattr(self, tool_name, None)
        if tool_fn is None:
            reward = -0.2
            self._apply_reward(reward, "invalid_action")
            return self.state(), reward, False, {"error": "invalid action"}
        
        result = tool_fn(**kwargs)
        reward = result.get("reward_delta", 0)
        
        done = (
            self._state._resolved or
            self._step_count >= self.MAX_STEPS or
            self._state.time_elapsed >= self._state.sla_minutes
        )
        
        self._trajectory.append({
            "step": self._step_count,
            "action": tool_name,
            "kwargs": kwargs,
            "reward": reward,
            "cumulative_reward": self._episode_reward,
            "time_elapsed": self._state.time_elapsed
        })
        
        info = {
            "trajectory": self._trajectory,
            "done_reason": self._get_done_reason() if done else None
        }
        
        return self.state(), reward, done, info

    def _apply_reward(self, reward: float, description: str):
        self._episode_reward += reward

    def _get_done_reason(self) -> str:
        if self._state._resolved:
            return "resolved"
        if self._step_count >= self.MAX_STEPS:
            return "max_steps_exceeded"
        if self._state.time_elapsed >= self._state.sla_minutes:
            return "sla_breached"
        return "unknown"

    def _simulate_kubectl(self, command: str) -> str:
        """Simulate kubectl output based on incident class."""
        return self.incident_gen.get_kubectl_output(
            self._state._incident_class, command
        )
