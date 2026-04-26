import os
os.environ["PYTORCH_ALLOC_CONF"] = "expandable_segments:True"
import argparse
import re
import json
import torch
import sys
import matplotlib.pyplot as plt
import threading
import time
from datetime import datetime
from datasets import Dataset

try:
    from unsloth import FastLanguageModel, PatchGRPO
    USE_UNSLOTH = True
    PatchGRPO() 
except ImportError:
    USE_UNSLOTH = False
    from peft import LoraConfig
    from transformers import BitsAndBytesConfig, AutoModelForCausalLM, AutoTokenizer
    from trl import GRPOConfig, GRPOTrainer

# Ensure AI package is discoverable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from environment.incident_env import IncidentMindEnv

def heartbeat():
    while True:
        print(f"[{datetime.now()}] Heartbeat: Training active...")
        time.sleep(300)

def reward_incident_resolution(prompts, completions, **kwargs):
    rewards = []
    for prompt, completion in zip(prompts, completions):
        try:
            json_match = re.search(r'\{.*"tool".*\}', completion, re.DOTALL)
            if json_match:
                call = json.loads(json_match.group())
                action, action_kwargs = call.get("tool", "invalid"), call.get("args", {})
            else:
                rewards.append(0.0); continue
        except Exception:
            rewards.append(-0.1); continue

        env = IncidentMindEnv()
        env.reset() 
        _, reward, done, _ = env.step(action, **action_kwargs)
        rewards.append(float(reward))
    return rewards

def reward_format_json(prompts, completions, **kwargs):
    return [1.0 if re.search(r'\{.*"tool":\s*".*".*\}', c, re.DOTALL) else 0.0 for c in completions]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--max_steps", type=int, default=50)
    args = parser.parse_args()

    # Device Discovery
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    
    print(f"[{datetime.now()}] Compute Engine: {device.upper()}")

    if USE_UNSLOTH:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name = args.model_id,
            max_seq_length = 512,
            load_in_4bit = True,
            fast_inference = True,
        )
        model = FastLanguageModel.get_peft_model(model, r = 16, target_modules = ["all-linear"], lora_alpha = 32)
    else:
        bnb_config = None
        if device == "cuda":
            bnb_config = BitsAndBytesConfig(load_in_4bit=True)
            
        model = AutoModelForCausalLM.from_pretrained(
            args.model_id,
            quantization_config=bnb_config,
            torch_dtype=torch.float16 if device == "mps" else torch.bfloat16,
            device_map={"": device} if device != "cpu" else "auto"
        )
        tokenizer = AutoTokenizer.from_pretrained(args.model_id)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

    env_classes = IncidentMindEnv.INCIDENT_CLASSES
    formatted_data = {"prompt": []}
    for cls in env_classes:
        formatted_data["prompt"].append([
            {"role": "system", "content": "Respond with JSON tool call."},
            {"role": "user", "content": f"Incident: {cls}"}
        ])
    dataset = Dataset.from_dict(formatted_data)

    config = GRPOConfig(
        output_dir="./incidentmind_policy",
        num_generations=2, 
        max_completion_length=128,
        per_device_train_batch_size=1,
        learning_rate=1e-5,
        logging_steps=1,
        max_steps=args.max_steps,
        report_to="none"
    )

    trainer = GRPOTrainer(
        model=model, args=config,
        reward_funcs=[reward_incident_resolution, reward_format_json],
        train_dataset=dataset, processing_class=tokenizer,
    )

    trainer.train()
    trainer.save_model("./incidentmind_final")

if __name__ == "__main__":
    main()
