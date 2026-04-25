"""
Tool definitions for the SRE Agent.
These map to the tools available in the IncidentMindEnv.
Used for LLM function-calling format when needed.
"""

TOOL_DEFINITIONS = [
    {
        "name": "query_logs",
        "description": "Query logs for a specific service. Returns recent log lines optionally filtered by text.",
        "parameters": {
            "type": "object",
            "properties": {
                "service": {"type": "string", "description": "Service name (e.g., 'api-gateway', 'postgres', 'orders-service')"},
                "time_range": {"type": "string", "enum": ["last_5m", "last_15m", "last_1h"], "default": "last_15m"},
                "filter_text": {"type": "string", "description": "Optional text filter for logs", "default": ""}
            },
            "required": ["service"]
        }
    },
    {
        "name": "fetch_metric",
        "description": "Fetch a Prometheus-style metric time series.",
        "parameters": {
            "type": "object",
            "properties": {
                "metric_name": {"type": "string", "description": "Metric name from available_metrics"},
                "window": {"type": "string", "enum": ["5m", "15m", "1h", "6h"], "default": "15m"}
            },
            "required": ["metric_name"]
        }
    },
    {
        "name": "run_kubectl",
        "description": "Run a kubectl command (read-only). Returns simulated output.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "kubectl command to run"}
            },
            "required": ["command"]
        }
    },
    {
        "name": "read_runbook",
        "description": "Read a specific runbook section for guidance.",
        "parameters": {
            "type": "object",
            "properties": {
                "section": {"type": "string", "description": "Runbook section name from state.runbook_sections"}
            },
            "required": ["section"]
        }
    },
    {
        "name": "post_hypothesis",
        "description": "Post a root cause hypothesis. Correct hypotheses earn rewards.",
        "parameters": {
            "type": "object",
            "properties": {
                "hypothesis": {"type": "string", "description": "Natural language hypothesis about root cause"},
                "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0, "default": 0.5}
            },
            "required": ["hypothesis"]
        }
    },
    {
        "name": "execute_fix",
        "description": "Execute a remediation action on a target service or resource.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "restart_service", "rollback_deploy", "scale_up",
                        "flush_connections", "rotate_certificate", "clear_disk",
                        "update_config", "update_rate_limit", "drain_node", "restart_pod"
                    ]
                },
                "target": {"type": "string", "description": "Service or resource name"},
                "parameters": {"type": "object", "description": "Action-specific parameters", "default": {}}
            },
            "required": ["action", "target"]
        }
    },
    {
        "name": "check_deploy_diff",
        "description": "Check what changed in a specific deploy SHA.",
        "parameters": {
            "type": "object",
            "properties": {
                "sha": {"type": "string", "description": "Deploy SHA from state.recent_deploys"}
            },
            "required": ["sha"]
        }
    },
    {
        "name": "query_slack",
        "description": "Search Slack for related messages about the incident.",
        "parameters": {
            "type": "object",
            "properties": {
                "channel": {"type": "string", "default": "incidents"},
                "keyword": {"type": "string", "default": ""}
            }
        }
    },
    {
        "name": "page_human",
        "description": "Escalate to a human SRE. Incurs a penalty if used prematurely.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Why you're escalating"},
                "urgency": {"type": "string", "enum": ["medium", "high", "critical"], "default": "high"}
            },
            "required": ["reason"]
        }
    },
    {
        "name": "mark_resolved",
        "description": "Mark the incident as resolved. Triggers final reward computation.",
        "parameters": {
            "type": "object",
            "properties": {
                "root_cause_analysis": {"type": "string", "description": "Detailed RCA text"},
                "fix_applied": {"type": "string", "description": "Description of fix that resolved the incident"}
            },
            "required": ["root_cause_analysis", "fix_applied"]
        }
    }
]


def get_tool_names() -> list[str]:
    return [t["name"] for t in TOOL_DEFINITIONS]


def get_tool_schema(tool_name: str) -> dict:
    for t in TOOL_DEFINITIONS:
        if t["name"] == tool_name:
            return t
    return {}
