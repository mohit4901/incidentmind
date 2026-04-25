"""
Generates realistic noisy log streams.
80% noise lines, 20% signal lines.
Signal lines contain clues about the true root cause.
"""

import random
from datetime import datetime, timedelta


NOISE_LINES = [
    "INFO  [2024-01-15 {ts}] HealthCheck: OK",
    "DEBUG [2024-01-15 {ts}] Cache hit for key user_session_{rand}",
    "INFO  [2024-01-15 {ts}] Request processed: GET /api/v1/health 200 3ms",
    "DEBUG [2024-01-15 {ts}] DB pool: {rand}/20 connections active",
    "INFO  [2024-01-15 {ts}] Scheduled job: cleanup_temp_files completed",
    "DEBUG [2024-01-15 {ts}] Token validated for user_{rand}",
    "INFO  [2024-01-15 {ts}] Request processed: POST /api/v1/events 201 45ms",
    "DEBUG [2024-01-15 {ts}] Metric flush: {rand} metrics sent to statsd",
    "INFO  [2024-01-15 {ts}] Rate limit check passed for IP 10.0.{rand}.{rand}",
    "DEBUG [2024-01-15 {ts}] Config loaded: production environment",
]

SIGNAL_LINES = {
    "oom_kill_cascade": [
        "FATAL [2024-01-15 {ts}] FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory",
        "ERROR [2024-01-15 {ts}] heap size: 511MB / 512MB limit — approaching OOM",
        "WARN  [2024-01-15 {ts}] Memory usage at 98%: 504MB / 512MB",
        "ERROR [2024-01-15 {ts}] Cache size: 847239 entries — no eviction policy set",
        "FATAL [2024-01-15 {ts}] Process killed by OOM killer (exit code 137)",
    ],
    "db_connection_pool": [
        "ERROR [2024-01-15 {ts}] Connection pool exhausted — all 20 connections busy",
        "ERROR [2024-01-15 {ts}] Timeout acquiring connection from pool after 30000ms",
        "WARN  [2024-01-15 {ts}] Pool utilization at 100% (20/20 connections)",
        "ERROR [2024-01-15 {ts}] Query failed: connect ETIMEDOUT — no available connections",
        "WARN  [2024-01-15 {ts}] Connection acquired but never released — potential leak",
    ],
    "bad_deploy_latency": [
        "WARN  [2024-01-15 {ts}] High DB query count: 847 queries for single request",
        "SLOW  [2024-01-15 {ts}] Query duration: 8432ms — SELECT * FROM products WHERE id=$1",
        "WARN  [2024-01-15 {ts}] N+1 query pattern detected in product catalog endpoint",
        "ERROR [2024-01-15 {ts}] Request timeout after 30s: GET /api/v1/products",
        "WARN  [2024-01-15 {ts}] DB connection hold time: 12s (threshold: 2s)",
    ],
    "certificate_expiry": [
        "ERROR [2024-01-15 {ts}] SSL: certificate verify failed: certificate has expired",
        "ERROR [2024-01-15 {ts}] TLS handshake error: certificate expired on 2024-01-14",
        "WARN  [2024-01-15 {ts}] cert-manager: DNS01 challenge failed: timeout",
        "ERROR [2024-01-15 {ts}] HTTPS connection refused: ERR_CERT_DATE_INVALID",
    ],
    "disk_saturation": [
        "ERROR [2024-01-15 {ts}] ENOSPC: no space left on device — cannot write log",
        "FATAL [2024-01-15 {ts}] Log write failed: disk full (/var/log: 100%)",
        "WARN  [2024-01-15 {ts}] Disk usage: /var/log 99.8% full (disk_size: 100GB)",
        "ERROR [2024-01-15 {ts}] logrotate failed: no space to create compressed archive",
    ]
}


class LogGenerator:
    def generate(self, incident_class: str, num_lines: int = 50) -> list[str]:
        noise_count = int(num_lines * 0.80)
        signal_count = int(num_lines * 0.20)
        
        signal_pool = SIGNAL_LINES.get(incident_class, [
            f"ERROR service experiencing issues related to {incident_class}"
        ])
        
        lines = []
        
        # Generate noise
        for _ in range(noise_count):
            template = random.choice(NOISE_LINES)
            ts = self._random_timestamp()
            rand = random.randint(100, 999)
            lines.append(template.format(ts=ts, rand=rand))
        
        # Inject signal (scattered, not at the end)
        for _ in range(signal_count):
            template = random.choice(signal_pool)
            ts = self._random_timestamp()
            rand = random.randint(100, 999)
            lines.append(template.format(ts=ts, rand=rand))
        
        # Shuffle so signal is not always at end
        random.shuffle(lines)
        
        # Add timestamps in order
        lines.sort()
        
        return lines
    
    def query(self, service: str, incident_class: str, filter_text: str = "") -> list[str]:
        """Return filtered logs relevant to service query."""
        all_logs = self.generate(incident_class, 100)
        
        if filter_text:
            filtered = [l for l in all_logs if filter_text.lower() in l.lower()]
            return filtered[:20] if filtered else all_logs[:10]
        
        return all_logs[:30]
    
    def _random_timestamp(self) -> str:
        h = random.randint(0, 23)
        m = random.randint(0, 59)
        s = random.randint(0, 59)
        return f"{h:02d}:{m:02d}:{s:02d}"
