"""
Generates realistic Prometheus-style metric time series.
"""

import random
import time
from datetime import datetime, timedelta

class MetricGenerator:
    def __init__(self):
        # Base values for metrics to make them look realistic
        self.base_metrics = {
            "container_memory_usage_bytes": 256 * 1024 * 1024,
            "container_memory_limit_bytes": 512 * 1024 * 1024,
            "http_request_duration_seconds": 0.2,
            "http_requests_total": 100,
            "pg_stat_activity_count": 15,
            "pg_settings_max_connections": 200,
            "node_filesystem_avail_bytes": 80 * 1024 * 1024 * 1024,
            "ssl_certificate_expiry_seconds": 30 * 24 * 3600,
        }

    def fetch(self, metric_name: str, incident_class: str, window: str = "15m") -> list:
        """Fetch simulated metric data points."""
        points = []
        now = datetime.now()
        
        # Determine duration in minutes
        minutes = 15
        if "5m" in window: minutes = 5
        elif "1h" in window: minutes = 60
        elif "6h" in window: minutes = 360

        base_val = self.base_metrics.get(metric_name, 100.0)
        
        for i in range(minutes):
            ts = (now - timedelta(minutes=minutes-i)).isoformat()
            val = base_val
            
            # Inject anomalies based on incident class
            if incident_class == "oom_kill_cascade" and "memory" in metric_name:
                # Memory growing linearly
                val = base_val + (i * 10 * 1024 * 1024)
            elif incident_class == "db_connection_pool" and "pg_stat_activity" in metric_name:
                # Connection pool spiking
                val = 190 + (i % 10)
            elif incident_class == "bad_deploy_latency" and "duration" in metric_name:
                # Latency spike
                val = 5.0 + random.uniform(0, 3.0)
            elif incident_class == "certificate_expiry" and "expiry" in metric_name:
                # Negative expiry
                val = -3600 + (i * 60)
            elif incident_class == "disk_saturation" and "avail_bytes" in metric_name:
                # Disk space dropping to zero
                val = max(0, (5 * 1024 * 1024) - (i * 1024 * 1024))
            else:
                # Normal noise
                val = base_val * (1 + random.uniform(-0.05, 0.05))
            
            points.append({"timestamp": ts, "value": round(val, 4)})
            
        return points
