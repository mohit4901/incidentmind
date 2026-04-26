import os
import json
import re
from groq import Groq

SYSTEM_PROMPT = """You are IncidentMind, an Expert Reliability RL Agent.
Your goal is to resolve service incidents through evidence-based reasoning.

RULES:
1. Always analyze evidence inside <thought></thought> tags.
2. Output a single JSON tool call as your final act.
3. Be grounded. If tools show no high latency, do not guess a fix.
4. PRIORITY: Once the root cause is identified, apply the fix immediately in the next step to prevent SLA decay.

AVAILABLE TOOLS:
- query_logs(service: str, filter_text: str = ""): Search pod logs.
- fetch_metric(service: str, metric_name: str): Get prometheus style data (e.g., cpu_usage, memory_usage, request_count).
- run_kubectl(service: str, command: str): Run commands like 'get pods', 'describe', 'top'.
- page_human(message: str): When all tools fail, escalate.
- execute_fix(service: str, action: str): FINAL ACTION. Actions: 'restart', 'scale_up', 'flush_cache', 'rollback'.

RESPONSE FORMAT:
<thought>Your deep forensic analysis here.</thought>
{"tool": "tool_name", "args": {"arg1": "val1"}}
"""

class SREAgent:
    def __init__(self, model_type="trained"):
        try:
            api_key = os.environ.get("GROQ_API_KEY")
            # Groq is our primary Brain. If Key is there, we get 70B intelligence.
            self.client = Groq(api_key=api_key) if api_key else None
        except Exception:
            self.client = None
            
        self.model = "llama-3.3-70b-versatile"
        self.model_type = model_type

    def act(self, obs: dict):
        """Standard rollout interface (2 values)."""
        action, kwargs, _ = self.act_with_reasoning(obs)
        return action, kwargs

    def act_with_reasoning(self, obs: dict):
        """Intelligence-First inference. Prioritizes Groq 70B."""
        if not self.client:
            return "query_logs", {"service": "api-gateway", "filter_text": "error"}, "Neural signal offline. Please set GROQ_API_KEY in HF Secrets."

        prompt = f"System State: {json.dumps(obs)}\nTask: Resolve the incident. Analyze concisely inside <thought>."
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=250 # Snap feedback
            )
            raw_content = response.choices[0].message.content
            
            # Extract reasoning
            reasoning = "System hypothesis active..."
            thought_match = re.search(r'<thought>(.*?)</thought>', raw_content, re.DOTALL)
            if thought_match:
                reasoning = thought_match.group(1).strip()

            # Extract tool call
            # Handle both raw JSON and JSON inside Markdown blocks
            json_str = raw_content
            markdown_match = re.search(r'```json\n(.*?)\n```', raw_content, re.DOTALL)
            if markdown_match:
                json_str = markdown_match.group(1)
            
            json_match = re.search(r'\{.*"tool".*\}', json_str, re.DOTALL)
            if json_match:
                call = json.loads(json_match.group())
                return call.get("tool", "invalid"), call.get("args", {}), reasoning
            
            return "invalid", {}, reasoning

        except Exception as e:
            print(f"[REASONING_ERROR] {e}")
            return "invalid", {}, f"Inference failed: {e}"
