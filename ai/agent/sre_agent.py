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

SYSTEM_PROMPT = """You are a Principal SRE Agent at a high-scale tech company.

REASONING PROTOCOL:
1. ALWAYS start your response with a <thought> block.
2. Analyze the current signals: What is broken? What is the evidence?
3. State your next intention clearly.
4. Respond with EXACTLY one JSON tool call after the thought block.

STRICT RULES:
- DO NOT hallucinate. Use only pod names and services mentioned in the state.
- Post a hypothesis BEFORE executing a fix.
- Query logs/metrics BEFORE hypothesizing.

Format:
<thought>Analyze signals here...</thought>
{"tool": "tool_name", "args": {...}}

Tools available:
- query_logs(service, filter_text)
- fetch_metric(metric_name, window)
- run_kubectl(command)
- read_runbook(section)
- post_hypothesis(hypothesis, confidence)
- execute_fix(action, target, parameters)
- check_deploy_diff(sha)
- query_slack(channel, keyword)
- page_human(reason, urgency)
- mark_resolved(root_cause_analysis, fix_applied)"""


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
        """Backward compatibility for simple act."""
        action, kwargs, _ = self.act_with_reasoning(observation)
        return action, kwargs

    def act_with_reasoning(self, observation: dict) -> tuple[str, dict, str]:
        """Given observation, return (action_name, kwargs, raw_llm_content)."""
        formatted_obs = self._format_observation(observation)
        
        if self.model_type == "untrained":
            action, kwargs = self._random_action(observation)
            return action, kwargs, "No reasoning (untrained mode)."
            
        return self._llm_action_with_raw(formatted_obs)

    def _llm_action_with_raw(self, formatted_obs: str) -> tuple[str, dict, str]:
        """Call LLM and return both action and raw reasoning."""
        if not self.client:
             a, k = self._random_action({})
             return a, k, "No API client."

        history = self.conversation_history
        is_looping = len(history) >= 4 and history[-1]["role"] == "assistant" and history[-3]["role"] == "assistant" 

        self.conversation_history.append({"role": "user", "content": formatted_obs})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": f"{SYSTEM_PROMPT}\nRule: BE CONCISE."},
                    *self.conversation_history[-8:]
                ],
                temperature=0.7 if is_looping else 0.1,
                max_tokens=300,
            )
            content = response.choices[0].message.content
            self.conversation_history.append({"role": "assistant", "content": content})
            action, kwargs = self._parse_tool_call(content)
            return action, kwargs, content
        except Exception as e:
            print(f"Turbo Fallback Triggered: {e}")
            return "query_logs", {"service": "postgres", "filter_text": "error"}, f"Error: {e}"
    
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
