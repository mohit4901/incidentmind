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
            reward += 0.4 # Increased from 0.3
        
        # Reward for relevant filter text
        incident_type = true_root_cause.split()[0].lower().replace(":", "")
        signals = ROOT_CAUSE_SIGNALS.get(incident_type, [])
        if any(sig in filter_text.lower() for sig in signals):
            reward += 0.3 # Increased from 0.2
        
        # LOGARITHMIC PENALTY (Fairness Upgrade)
        action_str = f"query_logs(service={service}, filter={filter_text})"
        duplicates = sum(1 for a in action_history if a == action_str)
        if duplicates > 1:
            # Penalty starts small and caps at -0.5 total
            reward -= min(0.5, 0.1 * (duplicates - 1))
        
        return round(reward, 2)
    
    def score_fetch_metric(self, metric_name, true_root_cause, action_history) -> float:
        reward = 0.0
        
        # Check if this is a high-signal metric
        incident_type = true_root_cause.split()[0].lower().replace(":", "")
        for cls_name, correct_metrics in CORRECT_METRICS_PER_CLASS.items():
            if cls_name in incident_type:
                if metric_name in correct_metrics:
                    reward += 0.5
                    break
        
        if reward == 0:
            reward = 0.1 # Exploration reward
        
        # Capped Repetition Penalty
        action_str = f"fetch_metric({metric_name}"
        duplicates = sum(1 for a in action_history if action_str in a)
        if duplicates > 1:
            reward -= min(0.3, 0.1 * (duplicates - 1))
        
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
    
    def score_tenet_adherence(self, action_history) -> float:
        """
        Rewards adherence to Senior SRE Tenets:
        1. Observable Evidence -> Hypothesis -> Action (The Data-Driven Tenet)
        """
        tenet_bonus = 0.0
        
        # Check if logs/metrics came BEFORE hypothesis
        first_hyp = -1
        last_obs = -1
        
        for i, action in enumerate(action_history):
            if any(x in action for x in ["query_logs", "fetch_metric", "run_kubectl"]):
                last_obs = i
            if "post_hypothesis" in action and first_hyp == -1:
                first_hyp = i
        
        if first_hyp > last_obs and last_obs != -1:
            tenet_bonus += 0.5  # Data-driven deduction bonus
            
        # Check if verification came AFTER fix
        first_fix = -1
        verification = -1
        for i, action in enumerate(action_history):
            if "execute_fix" in action and first_fix == -1:
                first_fix = i
            if i > first_fix and first_fix != -1:
                 if any(x in action for x in ["fetch_metric", "query_logs"]):
                     verification = i
                     
        if verification > first_fix and first_fix != -1:
            tenet_bonus += 0.5  # Post-fix verification bonus (Best Practice!)
            
        return tenet_bonus

    def calculate_economic_impact(self, steps, resolved) -> float:
        """Cool shit: Calculate simulated revenue saved ($10k / min)"""
        if not resolved: return -500000.0 # Catastrophic failure
        
        # Base cost of downtime is $500k. Every step takes ~2 mins.
        savings = 500000.0 - (steps * 2.0 * 10000.0)
        return max(0, savings)

    def score_resolution(self, rca_text, fix_description, true_root_cause, true_fix,
                         correct_fix_applied, time_elapsed, sla_minutes, fix_attempts,
                         step_count, hypothesis_log, action_history) -> float:
        """
        ULTRA-STRONG GRADING SYSTEM
        """
        total_reward = 0.0
        
        # 1. RCA quality
        incident_type = true_root_cause.split()[0].lower().replace(":", "")
        signals = ROOT_CAUSE_SIGNALS.get(incident_type, [])
        rca_matches = sum(1 for sig in signals if sig in rca_text.lower())
        rca_score = min(2.0, rca_matches * 0.5)
        total_reward += rca_score
        
        # 2. Fix correctness (Major weight)
        if correct_fix_applied:
            total_reward += 5.0 # Increased from 4.0
            
            # 3. SRE Tenet Adherence (Logical flow)
            tenet_bonus = self.score_tenet_adherence(action_history)
            total_reward += tenet_bonus
            
            # 4. Economic Multiplier (Extreme Incentive)
            efficiency_factor = max(0.8, 2.5 * (1.0 - (step_count / 50.0)))
            total_reward *= efficiency_factor
        else:
            total_reward -= 3.0 # Heavier penalty for failure
        
        # 5. Anti-Spam / Noise Penalty
        if step_count > 15:
            total_reward -= (step_count - 15) * 0.1
        
        return round(total_reward, 2)
