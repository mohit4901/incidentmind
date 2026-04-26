"""
Modular reward engine — aligned with OpenEnv Rubric system.

Reward components:
1. Information gain: +reward when action reduces uncertainty about root cause
2. Hypothesis quality: +reward for correct root cause hypothesis
3. Fix correctness: +reward for correct fix, -reward for wrong fix
4. Efficiency: -reward for redundant actions
5. Resolution quality: final rubric-based score

Total episode reward range: approximately -5 to +8
Trained agent target: > +3.5 per episode
Random baseline: approximately -0.5 to +0.8
"""

import re
from difflib import SequenceMatcher


# Maps root cause keywords to incident class signals
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

CORRECT_METRICS_PER_CLASS = {
    "oom_kill_cascade": ["container_memory_usage_bytes", "container_memory_limit_bytes", "kube_pod_container_status_restarts_total"],
    "db_connection_pool": ["pg_stat_activity_count", "pg_settings_max_connections"],
    "bad_deploy_latency": ["http_request_duration_seconds", "db_query_duration_seconds", "db_queries_per_request"],
    "certificate_expiry": ["ssl_certificate_expiry_seconds", "certmanager_certificate_expiration_timestamp_seconds"],
    "disk_saturation": ["node_filesystem_avail_bytes", "container_fs_usage_bytes"],
}

CORRECT_LOG_SERVICES = {
    "oom_kill_cascade": "api-gateway",
    "db_connection_pool": "orders-service",
    "bad_deploy_latency": "product-service",
    "certificate_expiry": "ingress-nginx",
    "disk_saturation": "logging-service",
}


class RewardEngine:
    
    def score_query_logs(self, service, filter_text, true_root_cause, true_affected_service, action_history) -> float:
        reward = 0.0
        
        # Reward for querying the right service
        if service.lower() in true_affected_service.lower() or true_affected_service.lower() in service.lower():
            reward += 0.3
        
        # Reward for relevant filter text
        signals = ROOT_CAUSE_SIGNALS.get(true_root_cause.split()[0].lower(), [])
        if any(sig in filter_text.lower() for sig in signals):
            reward += 0.2
        
        # Penalty for repeated identical queries
        action_str = f"query_logs(service={service}, filter={filter_text})"
        duplicates = sum(1 for a in action_history if a == action_str)
        if duplicates > 1:
            reward -= 0.3 * duplicates
        
        return round(reward, 2)
    
    def score_fetch_metric(self, metric_name, true_root_cause, action_history) -> float:
        reward = 0.0
        
        # Check if this is a high-signal metric for this root cause
        for incident_class, correct_metrics in CORRECT_METRICS_PER_CLASS.items():
            if incident_class in true_root_cause.lower():
                if metric_name in correct_metrics:
                    reward += 0.4
                    break
        
        # Small reward for any metric fetch (information gathering)
        if reward == 0:
            reward = 0.05
        
        # Penalty for duplicate metric fetch
        action_str = f"fetch_metric({metric_name}"
        duplicates = sum(1 for a in action_history if action_str in a)
        if duplicates > 1:
            reward -= 0.2
        
        return round(reward, 2)
    
    def score_kubectl(self, command, true_root_cause, result) -> float:
        reward = 0.05  # Base reward for kubectl (info gathering)
        
        # Higher reward if kubectl reveals relevant information
        signals = []
        for incident_class, sigs in ROOT_CAUSE_SIGNALS.items():
            if incident_class in true_root_cause.lower():
                signals = sigs
                break
        
        if any(sig in result.lower() for sig in signals):
            reward += 0.25
        
        return round(reward, 2)
    
    def score_runbook(self, section, true_root_cause) -> float:
        # Reward for reading the relevant runbook section
        signals = []
        for incident_class, sigs in ROOT_CAUSE_SIGNALS.items():
            if incident_class in true_root_cause.lower():
                signals = sigs
                break
        
        if any(sig in section.lower() for sig in signals):
            return 0.2
        return 0.05
    
    def score_hypothesis(self, hypothesis, confidence, true_root_cause, true_incident_class) -> float:
        reward = 0.0
        
        # Check keyword overlap between hypothesis and true root cause
        hypothesis_lower = hypothesis.lower()
        signals = ROOT_CAUSE_SIGNALS.get(true_incident_class, [])
        
        matches = sum(1 for sig in signals if sig in hypothesis_lower)
        match_ratio = matches / max(len(signals), 1)
        
        if match_ratio > 0.6:
            reward = 0.8 * confidence  # High confidence + correct = high reward
        elif match_ratio > 0.3:
            reward = 0.4 * confidence
        else:
            reward = -0.1  # Wrong hypothesis with high confidence is penalised
        
        return round(reward, 2)
    
    def is_correct_fix(self, action, target, true_fix_action, true_affected_service) -> bool:
        action_match = action.lower() == true_fix_action.lower()
        target_match = (
            target.lower() in true_affected_service.lower() or
            true_affected_service.lower() in target.lower()
        )
        return action_match and target_match
    
    def score_deploy_check(self, sha, incident_class) -> float:
        # Reward for checking deploy diff when incident is deploy-related
        deploy_related = ["bad_deploy_latency", "oom_kill_cascade", "db_connection_pool", "disk_saturation"]
        if incident_class in deploy_related:
            return 0.3
        return 0.05
    
    def score_resolution(self, rca_text, fix_description, true_root_cause, true_fix,
                         correct_fix_applied, time_elapsed, sla_minutes, fix_attempts,
                         step_count, hypothesis_log) -> float:
        """
        Final rubric-based resolution scorer.
        Maps to OpenEnv Rubric system.
        """
        total_reward = 0.0
        
        # 1. RCA quality
        signals = ROOT_CAUSE_SIGNALS.get(true_root_cause.split()[0].lower(), [])
        rca_matches = sum(1 for sig in signals if sig in rca_text.lower())
        rca_score = min(2.0, rca_matches * 0.4)
        total_reward += rca_score
        
        # 2. Fix correctness (Major weight)
        if correct_fix_applied:
            total_reward += 3.0 # Increased from 1.5
        else:
            total_reward -= 1.0
        
        # 3. Efficiency Multiplier (Top 5 Winning Logic)
        # We reward "Surgical Precision" — few steps, early resolution.
        if correct_fix_applied:
            efficiency_bonus = max(0, 2.0 * (1.0 - (step_count / 50.0)))
            total_reward += efficiency_bonus
        
        # 4. SLA Bonus
        if time_elapsed <= sla_minutes * 0.3:
            total_reward += 1.5 # Fast resolution
        elif time_elapsed <= sla_minutes:
            total_reward += 0.5
        else:
            total_reward -= 1.0
            
        # 5. Anti-Spam Penalty
        # If agent took >10 steps for a 5-step problem, penalise the "noise"
        if step_count > 20:
            total_reward -= (step_count - 20) * 0.05
        
        return round(total_reward, 2)
