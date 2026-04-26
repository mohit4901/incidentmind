"""
SRE Agent — wraps LLM (Groq/Qwen) with tool-use for incident resolution.
Uses Groq API for fast inference (free tier available).
"""

import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are an expert Site Reliability Engineer (SRE) handling a live production incident.

You have access to these tools:
- query_logs(service, filter_text): Search logs for a specific service
- fetch_metric(metric_name, window): Get a Prometheus metric time series  
- run_kubectl(command): Run kubectl commands (read-only)
- read_runbook(section): Read a specific runbook section
- post_hypothesis(hypothesis, confidence): Post your root cause hypothesis
- execute_fix(action, target, parameters): Execute a remediation action
- check_deploy_diff(sha): Check what changed in a deploy
- query_slack(channel, keyword): Search Slack for context
- page_human(reason, urgency): Escalate to human (use only if truly stuck)
- mark_resolved(root_cause_analysis, fix_applied): Mark incident as resolved

STRICT RULES:
1. ALWAYS start by reading the alert carefully
2. NEVER execute a fix without first posting a hypothesis
3. Query logs and metrics BEFORE hypothesizing
4. If you try a fix and metrics don't improve, do NOT retry the same fix
5. Be methodical: Observe → Hypothesize → Investigate → Fix → Verify → Resolve
6. Time matters — SLA is 30 minutes. Be efficient.

Respond with EXACTLY ONE tool call per response in this JSON format:
{"tool": "tool_name", "args": {"arg1": "value1", "arg2": "value2"}}

Think step by step before each action. What do you know? What do you need to know?"""


class SREAgent:
    def __init__(self, model_type: str = "trained"):
        self.model_type = model_type
        # API Key check handled in act() to avoid crash on init if not set
        self.api_key = os.environ.get("GROQ_API_KEY")
        self.model = "llama-3.1-8b-instant"  # Fast, free on Groq
        self.conversation_history = []
        self._client = None

    @property
    def client(self):
        if self._client is None and self.api_key:
            self._client = Groq(api_key=self.api_key)
        return self._client
    
    def act(self, observation: dict) -> tuple[str, dict]:
        """Given observation, return (action_name, kwargs)."""
        formatted_obs = self._format_observation(observation)
        
        if self.model_type == "untrained":
            return self._random_action(observation)
            
        if self.model_type == "trained":
            # In Hackathon, we use Groq for fast demo, or local PEFT model if available
            return self._llm_action(formatted_obs)

        return self._random_action(observation)

    def _llm_action(self, formatted_obs: str) -> tuple[str, dict]:
        """Call LLM with formatted observation and system prompt."""
        if not self.client:
            return self._random_action({})

        self.conversation_history.append({"role": "user", "content": formatted_obs})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *self.conversation_history[-5:] # Context window
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            self.conversation_history.append({"role": "assistant", "content": content})
            return self._parse_tool_call(content)
        except Exception as e:
            print(f"Agent Inference Error: {e}")
            return "query_logs", {"service": "api-gateway", "filter_text": "error"}
    
    def _format_observation(self, obs: dict) -> str:
        return f"""
ALERT: {json.dumps(obs.get('alert', {}), indent=2)}

TIME ELAPSED: {obs.get('time_elapsed_minutes', 0)} minutes / SLA: {obs.get('sla_remaining_minutes', 30)} min remaining

RECENT LOGS (last 10):
{chr(10).join(obs.get('logs', [])[-10:])}

AVAILABLE METRICS: {', '.join(obs.get('available_metrics', []))}

POD STATUS: {json.dumps(obs.get('pod_status', {}), indent=2)}

RECENT DEPLOYS: {json.dumps(obs.get('recent_deploys', []), indent=2)}

ACTIONS TAKEN: {', '.join(obs.get('action_history', [])[-5:])}

HYPOTHESES POSTED: {obs.get('hypothesis_log', [])}

CURRENT REWARD: {obs.get('episode_reward_so_far', 0):.2f}
"""
    
    def _parse_tool_call(self, content: str) -> tuple[str, dict]:
        """Extract tool call from LLM response."""
        try:
            # Look for JSON in response
            json_match = re.search(r'\{[^{}]*"tool"[^{}]*\}', content, re.DOTALL)
            if json_match:
                call = json.loads(json_match.group())
                return call["tool"], call.get("args", {})
        except:
            pass
        
        # Fallback: parse natural language action
        content_lower = content.lower()
        if "query_logs" in content_lower:
            return "query_logs", {"service": "api-gateway", "filter_text": "error"}
        if "fetch_metric" in content_lower:
            return "fetch_metric", {"metric_name": "http_request_duration_seconds"}
        if "hypothesis" in content_lower:
            return "post_hypothesis", {"hypothesis": content[:200], "confidence": 0.5}
        if "kubectl" in content_lower:
            return "run_kubectl", {"command": "get pods -n production"}
        if "mark_resolved" in content_lower:
            return "mark_resolved", {"root_cause_analysis": content, "fix_applied": "executed fix"}
        
        return "query_logs", {"service": "api-gateway", "filter_text": "error"}
    
    def _random_action(self, observation: dict) -> tuple[str, dict]:
        """Untrained baseline — random actions for before/after comparison."""
        import random
        actions = [
            ("query_logs", {"service": "api-gateway", "filter_text": ""}),
            ("fetch_metric", {"metric_name": "http_requests_total"}),
            ("run_kubectl", {"command": "get pods"}),
            ("execute_fix", {"action": "restart_service", "target": "postgres"}),  # Wrong fix early
            ("page_human", {"reason": "Not sure what's happening", "urgency": "high"}),
        ]
        return random.choice(actions)
    
    def reset(self):
        """Reset conversation for new episode."""
        self.conversation_history = []
