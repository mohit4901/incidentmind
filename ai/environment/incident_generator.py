"""
Generates realistic incident scenarios from 20 incident class templates.
Data sourced from: Google SRE Workbook patterns, public GitHub postmortems,
Atlassian incident database patterns.
"""

import random
import json
from datetime import datetime, timedelta


INCIDENT_TEMPLATES = {
    "oom_kill_cascade": {
        "alert": {
            "title": "CRITICAL: Multiple OOMKilled pods in production",
            "service": "api-gateway",
            "severity": "P0",
            "triggered_at": None,  # Set at generation time
            "error_rate": "87%",
            "source": "PagerDuty",
            "runbook_url": "https://runbooks.internal/oom-kill"
        },
        "root_cause": "Memory leak in api-gateway v2.4.1 causing OOM kills, cascading to downstream services",
        "affected_service": "api-gateway",
        "correct_fix": "rollback_deploy",
        "available_metrics": [
            "container_memory_usage_bytes", "container_memory_limit_bytes",
            "kube_pod_container_status_restarts_total", "http_request_duration_seconds",
            "http_requests_total", "node_memory_MemAvailable_bytes"
        ],
        "runbook_sections": [
            "check_pod_restarts", "analyze_memory_usage", "check_recent_deploys",
            "rollback_procedure", "scaling_procedure", "alerting_thresholds"
        ],
        "pod_status": {
            "api-gateway-xxxx1": "OOMKilled (3 restarts)",
            "api-gateway-xxxx2": "OOMKilled (2 restarts)",
            "api-gateway-xxxx3": "Running",
            "postgres-primary": "Running",
            "redis-cache": "Running"
        },
        "recent_deploys": [
            {"sha": "a3f8c21", "service": "api-gateway", "time": "23 minutes ago", "author": "rohit.sharma"},
            {"sha": "b2e1d99", "service": "auth-service", "time": "2 hours ago", "author": "priya.k"},
            {"sha": "c9d3a11", "service": "billing", "time": "6 hours ago", "author": "amit.j"}
        ],
        "slack_thread": [
            "rohit.sharma: just deployed api-gateway v2.4.1, should be live now",
            "alerts-bot: [ALERT] api-gateway pod OOMKilled",
            "priya.k: is this related to the new deploy?",
            "on-call-bot: P0 incident opened: INC-4421"
        ],
        "kubectl_outputs": {
            "get pods": "api-gateway-xxxx1   0/1   OOMKilled   3   18m\napi-gateway-xxxx2   0/1   OOMKilled   2   8m",
            "describe pod api-gateway": "Reason: OOMKilled\nLast State: Terminated\nExit Code: 137\nMemory Limit: 512Mi\nMemory Request: 256Mi",
            "logs api-gateway": "FATAL: heap out of memory\nError: JavaScript heap out of memory\nFATAL ERROR: CALL_AND_RETRY_LAST Allocation failed"
        },
        "deploy_diffs": {
            "a3f8c21": "Changed: api-gateway/src/cache.js\n+ const cache = new Map()  // unbounded cache, no TTL or size limit\n+ cache.set(userId, fullResponseObject)  // storing entire response objects"
        }
    },
    
    "db_connection_pool": {
        "alert": {
            "title": "CRITICAL: Database connection pool exhausted — orders service down",
            "service": "orders-service",
            "severity": "P0",
            "triggered_at": None,
            "error_rate": "94%",
            "source": "PagerDuty",
            "runbook_url": "https://runbooks.internal/db-connections"
        },
        "root_cause": "orders-service connection pool size too small after traffic spike, connections not released due to missing connection.release() call",
        "affected_service": "orders-service",
        "correct_fix": "flush_connections",
        "available_metrics": [
            "pg_stat_activity_count", "pg_settings_max_connections",
            "http_request_duration_seconds", "http_requests_total",
            "orders_processed_total", "db_query_duration_seconds"
        ],
        "runbook_sections": [
            "check_active_connections", "identify_connection_leak",
            "emergency_connection_flush", "pool_size_configuration",
            "query_analysis", "pgbouncer_configuration"
        ],
        "pod_status": {
            "orders-service-xxx1": "Running (high latency)",
            "orders-service-xxx2": "Running (high latency)",
            "postgres-primary": "Running",
            "pgbouncer": "Running"
        },
        "recent_deploys": [
            {"sha": "d4e7f33", "service": "orders-service", "time": "45 minutes ago", "author": "ankit.v"},
            {"sha": "e5a8b22", "service": "payment-service", "time": "3 hours ago", "author": "meera.p"},
        ],
        "slack_thread": [
            "ankit.v: deployed orders-service with new DB query optimizations",
            "alerts-bot: [ALERT] orders-service p99 latency > 30s",
            "meera.p: orders are failing on my end too",
            "db-monitor: postgres max_connections approaching limit (195/200)"
        ],
        "kubectl_outputs": {
            "get pods": "orders-service-xxx1   1/1   Running   0   2h\norders-service-xxx2   1/1   Running   0   2h",
            "logs orders-service": "Error: Connection pool exhausted\nError: connect ETIMEDOUT — all connections busy\ntimeout acquiring connection from pool after 30000ms"
        },
        "deploy_diffs": {
            "d4e7f33": "Changed: orders-service/src/db/queries.js\n+ const result = await pool.connect()\n+ // BUG: missing result.release() — connection never returned to pool\n+ return await result.query(sql)"
        }
    },
    
    "bad_deploy_latency": {
        "alert": {
            "title": "P0: API latency spike — p99 > 8s (baseline: 200ms)",
            "service": "product-service", 
            "severity": "P0",
            "triggered_at": None,
            "error_rate": "12%",
            "source": "Datadog",
            "runbook_url": "https://runbooks.internal/latency-spike"
        },
        "root_cause": "N+1 database query introduced in product-service v3.1.0 — querying DB once per item instead of batch",
        "affected_service": "product-service",
        "correct_fix": "rollback_deploy",
        "available_metrics": [
            "http_request_duration_seconds", "db_query_duration_seconds",
            "db_queries_per_request", "http_requests_total",
            "cpu_usage_percent", "memory_usage_bytes"
        ],
        "runbook_sections": [
            "latency_analysis", "db_query_analysis", "recent_deploy_check",
            "rollback_procedure", "profiling_guide", "caching_options"
        ],
        "pod_status": {
            "product-service-xx1": "Running",
            "product-service-xx2": "Running",
            "postgres-primary": "Running (high query load)"
        },
        "recent_deploys": [
            {"sha": "f1b2c33", "service": "product-service", "time": "12 minutes ago", "author": "sanjay.m"},
        ],
        "slack_thread": [
            "sanjay.m: shipping product catalog v3.1.0 — adds rich product metadata",
            "alerts-bot: [ALERT] product-service p99 latency > 5s",
            "customer-success: getting reports of slow product pages"
        ],
        "kubectl_outputs": {
            "get pods": "product-service-xx1   1/1   Running   0   1h",
            "logs product-service": "SELECT * FROM products WHERE id=$1 -- called 847 times in 200ms\nWARN: high query count detected"
        },
        "deploy_diffs": {
            "f1b2c33": "Changed: product-service/src/catalog.js\n- const products = await Product.findAll({ include: 'metadata', batch: true })\n+ for (const id of productIds) {\n+   products.push(await Product.findOne({ where: { id }, include: 'metadata' }))  // N+1 query\n+ }"
        }
    },

    "certificate_expiry": {
        "alert": {
            "title": "CRITICAL: TLS certificate expired — HTTPS failing for api.company.com",
            "service": "ingress-nginx",
            "severity": "P0",
            "triggered_at": None,
            "error_rate": "100%",
            "source": "Pingdom",
            "runbook_url": "https://runbooks.internal/cert-expiry"
        },
        "root_cause": "TLS certificate for api.company.com expired — cert-manager auto-renewal failed due to DNS validation timeout",
        "affected_service": "ingress-nginx",
        "correct_fix": "rotate_certificate",
        "available_metrics": [
            "ssl_certificate_expiry_seconds", "nginx_ingress_controller_requests",
            "nginx_ingress_controller_ssl_expire_time_seconds",
            "certmanager_certificate_expiration_timestamp_seconds"
        ],
        "runbook_sections": [
            "check_certificate_expiry", "manual_cert_renewal",
            "certmanager_troubleshooting", "dns_validation_check",
            "emergency_selfsigned_fallback"
        ],
        "pod_status": {
            "ingress-nginx-controller": "Running",
            "cert-manager": "Running",
            "cert-manager-webhook": "Running"
        },
        "recent_deploys": [
            {"sha": "no_recent_deploy", "service": "N/A", "time": "N/A", "author": "N/A"}
        ],
        "slack_thread": [
            "monitoring-bot: SSL cert for api.company.com expires in 0 days",
            "alerts-bot: [CRITICAL] HTTPS requests failing with SSL_ERROR_RX_RECORD_TOO_LONG",
            "platform-team: checking cert-manager logs now"
        ],
        "kubectl_outputs": {
            "get certificates": "api-cert   False   api.company.com   0d   EXPIRED",
            "describe certificate api-cert": "Status: False\nReason: cert-manager failed DNS01 challenge\nLast Failure: DNS timeout resolving _acme-challenge.api.company.com"
        },
        "deploy_diffs": {}
    },

    "disk_saturation": {
        "alert": {
            "title": "P0: Disk full — logging service down",
            "service": "logging-service",
            "severity": "P0",
            "triggered_at": None,
            "error_rate": "78%",
            "source": "Prometheus",
            "runbook_url": "https://runbooks.internal/disk-full"
        },
        "root_cause": "unbounded logs in /var/log",
        "affected_service": "logging-service",
        "correct_fix": "clear_disk",
        "available_metrics": ["node_filesystem_avail_bytes", "container_fs_usage_bytes"],
        "runbook_sections": ["identify_disk_usage", "emergency_disk_cleanup"],
        "pod_status": {"logging-service-xxx": "CrashLoopBackOff"},
        "recent_deploys": [{"sha": "g2h3i44", "service": "logging-service", "time": "6h ago"}],
        "slack_thread": ["deepak.r: updated log format", "alerts-bot: /var/log 100%"],
        "kubectl_outputs": {"logs logging-service": "Error: ENOSPC"},
        "deploy_diffs": {"g2h3i44": "Changed logrotate: rotate 0"}
    },
    "dns_misconfiguration": {
        "alert": {"title": "P1: DNS resolution failing for upstream-api", "service": "payment-service", "severity": "P1"},
        "root_cause": "Invalid CNAME record in CoreDNS configMap for upstream-api.service.svc.cluster.local",
        "affected_service": "payment-service", "correct_fix": "update_config",
        "available_metrics": ["coredns_dns_request_count_total", "coredns_dns_response_rcode_count_total"],
        "runbook_sections": ["dns_troubleshooting"],
        "pod_status": {"coredns": "Running", "payment-service": "Running (errors)"},
        "recent_deploys": [], "slack_thread": ["system: CoreDNS config updated by CI"],
        "kubectl_outputs": {"logs payment-service": "getaddrinfo ENOTFOUND upstream-api"},
        "deploy_diffs": {}
    },
    "cpu_spike_cascade": {
        "alert": {"title": "P0: Massive CPU spike in checkout-service", "service": "checkout-service", "severity": "P0"},
        "root_cause": "Inefficient regex causing ReDoS",
        "affected_service": "checkout-service", "correct_fix": "rollback_deploy",
        "available_metrics": ["container_cpu_usage_seconds_total"],
        "runbook_sections": ["cpu_profiling"],
        "pod_status": {"checkout-service": "Running (Throttled)"},
        "recent_deploys": [{"sha": "cpu9922", "service": "checkout-service", "time": "10m ago"}],
        "slack_thread": ["alerts: checkout p99 latency 15s"],
        "kubectl_outputs": {"describe pod": "CPU limit reached"},
        "deploy_diffs": {"cpu9922": "+ const regex = /^(a+)+$/;"}
    },
    "ingress_misconfiguration": {
        "alert": {"title": "P0: Ingress 502 Errors — API Unreachable", "service": "ingress-nginx", "severity": "P0"},
        "root_cause": "Wrong service port in Ingress path configuration after service refactor",
        "affected_service": "ingress-nginx", "correct_fix": "update_config",
        "available_metrics": ["nginx_ingress_controller_requests"],
        "runbook_sections": ["check_ingress_config"],
        "pod_status": {"ingress-nginx-controller": "Running"},
        "recent_deploys": [{"sha": "ing77", "service": "infrastructure", "time": "5m ago"}],
        "slack_thread": ["alerts: 502 errors spiking"],
        "kubectl_outputs": {"get ingress": "path: /api -> service: api-gateway:80 (targetPort should be 8080)"},
        "deploy_diffs": {"ing77": "- port: 8080\n+ port: 80"}
    },
    "rate_limit_misconfiguration": {
        "alert": {"title": "P2: 429 Errors for legitimate traffic", "service": "api-gateway", "severity": "P2"},
        "root_cause": "Internal service IP range accidentally included in global rate limit broad bucket",
        "affected_service": "api-gateway", "correct_fix": "update_rate_limit",
        "available_metrics": ["http_requests_total"],
        "runbook_sections": ["check_rate_limits"],
        "pod_status": {"api-gateway": "Running"},
        "recent_deploys": [{"sha": "rl55", "service": "api-gateway", "time": "1h ago"}],
        "slack_thread": ["frontend: users getting 429s"],
        "kubectl_outputs": {"logs api-gateway": "RateLimit exceeded for IP 10.0.1.45"},
        "deploy_diffs": {"rl55": "Modified rate-limit config: default bucket reduced to 10req/sec"}
    }
}


class IncidentGenerator:
    def __init__(self):
        self.templates = INCIDENT_TEMPLATES
    
    def generate(self, incident_class: str) -> dict:
        if incident_class not in self.templates:
            # Fallback to a random known class
            incident_class = random.choice(list(self.templates.keys()))
        
        template = self.templates[incident_class].copy()
        template["alert"] = template["alert"].copy()
        template["alert"]["triggered_at"] = datetime.utcnow().isoformat() + "Z"
        template["incident_class"] = incident_class
        
        # Add some randomness to make episodes varied
        template["alert"]["error_rate"] = f"{random.randint(70, 98)}%"
        
        return template
    
    def get_runbook_section(self, incident_class: str, section: str) -> str:
        runbooks = {
            "check_pod_restarts": "kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'\nLook for pods with >3 restarts in the last hour.\nIf OOMKilled: check memory limits vs actual usage.",
            "analyze_memory_usage": "kubectl top pods -n production\nfetch_metric: container_memory_usage_bytes / container_memory_limit_bytes\nIf usage > 90% of limit consistently, likely leak.",
            "check_recent_deploys": "Review recent_deploys in state. Check if latency/errors correlate with deploy time.\nquery_logs from the deployed service immediately post-deploy.",
            "rollback_procedure": "execute_fix(action='rollback_deploy', target='<service>', parameters={'sha': '<previous_sha>'})\nMonitor metrics for 5 minutes post-rollback.",
            "check_active_connections": "fetch_metric: pg_stat_activity_count\nIf approaching max_connections (200 default), pool exhaustion likely.\nrun_kubectl: logs <postgres-pod> | grep 'connection'",
            "emergency_connection_flush": "execute_fix(action='flush_connections', target='postgres')\nThis terminates idle connections. Safe in emergency.",
            "latency_analysis": "fetch_metric: http_request_duration_seconds (p99, p95, p50)\nIf p99 >> p50, suggests occasional expensive operations.\nfetch_metric: db_query_duration_seconds to check if DB is the bottleneck.",
            "check_certificate_expiry": "fetch_metric: ssl_certificate_expiry_seconds\nrun_kubectl: get certificates -n production\nIf expiry_seconds < 0, cert is already expired.",
            "manual_cert_renewal": "execute_fix(action='rotate_certificate', target='api-cert')\nThis triggers cert-manager to force-renew.",
            "identify_disk_usage": "fetch_metric: node_filesystem_avail_bytes\nrun_kubectl: exec <pod> -- df -h /var/log\nLook for log files > 1GB.",
            "emergency_disk_cleanup": "execute_fix(action='clear_disk', target='/var/log', parameters={'older_than': '24h'})\nThis removes logs older than 24h. Irreversible.",
        }
        return runbooks.get(section, f"Runbook section '{section}' not found. Available: {list(runbooks.keys())}")
    
    def get_kubectl_output(self, incident_class: str, command: str) -> str:
        template = self.templates.get(incident_class, {})
        kubectl_outputs = template.get("kubectl_outputs", {})
        
        for key, output in kubectl_outputs.items():
            if key in command:
                return output
        
        return f"No resources found matching command: {command}"
    
    def get_deploy_diff(self, incident_class: str, sha: str) -> str:
        template = self.templates.get(incident_class, {})
        diffs = template.get("deploy_diffs", {})
        
        for key, diff in diffs.items():
            if key in sha or sha in key:
                return diff
        
        return f"No diff found for SHA {sha}. This deploy may not be related to the incident."
    
    def get_slack_messages(self, incident_class: str, keyword: str = "") -> list:
        template = self.templates.get(incident_class, {})
        messages = template.get("slack_thread", [])
        if keyword:
            messages = [m for m in messages if keyword.lower() in m.lower()]
        return messages
