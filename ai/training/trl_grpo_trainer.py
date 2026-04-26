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
from transformers import AutoTokenizer
from trl import GRPOConfig, GRPOTrainer
from unsloth import FastLanguageModel, PatchGRPO
PatchGRPO() # Meta-level optimization for GRPO

# Ensure AI package is discoverable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from environment.incident_env import IncidentMindEnv

def heartbeat():
    while True:
        print(f"[{datetime.now()}] Heartbeat: Training active...")
        time.sleep(300)

# ---------------------------------------------------------
# Reward Functions (Strictly matching TRL Signature)
# ---------------------------------------------------------
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

        # Rollout with LOOKAHEAD (The DeepMind way)
        env = IncidentMindEnv()
        env.reset() 
        _, reward, done, _ = env.step(action, **action_kwargs)
        
        # Lookahead: If it's a good step, see if it leads to resolution
        lookahead_reward = 0.0
        if not done and reward > 0:
            for _ in range(3):
                _, r, d, _ = env.step("query_logs", service="api-gateway")
                lookahead_reward += r
                if d: break
        
        rewards.append(float(reward + lookahead_reward * 0.2))
    return rewards

def reward_format_json(prompts, completions, **kwargs):
    return [1.0 if re.search(r'\{.*"tool":\s*".*".*\}', c, re.DOTALL) else 0.0 for c in completions]

# ---------------------------------------------------------
# Main Evolution Loop
# ---------------------------------------------------------
def main():
    # Start heartbeat to prevent timeout
    threading.Thread(target=heartbeat, daemon=True).start()

    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="unsloth/Qwen2.5-7B-Instruct-bnb-4bit")
    parser.add_argument("--max_steps", type=int, default=100)
    args = parser.parse_args()

    # UNSLOTH PEFT Loading (2x Faster, 40% less VRAM)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = args.model_id,
        max_seq_length = 512,
        load_in_4bit = True,
        fast_inference = True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r = 16,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                         "gate_proj", "up_proj", "down_proj",],
        lora_alpha = 32, lora_dropout = 0, bias = "none",
        use_gradient_checkpointing = "unsloth",
        random_state = 3407,
    )

    # Dataset: Full 20-Incident Diversity
    env_classes = IncidentMindEnv.INCIDENT_CLASSES
    formatted_data = {"prompt": []}
    for cls in env_classes * 5:
        formatted_data["prompt"].append([
            {"role": "system", "content": "Expert SRE. Respond with JSON inside <think> tags."},
            {"role": "user", "content": f"ALERT: {cls}. Action?"}
        ])
    dataset = Dataset.from_dict(formatted_data)

    config = GRPOConfig(
        output_dir="./incidentmind_policy",
        num_generations=4, # Group size
        max_completion_length=128,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=1e-5,
        logging_steps=1,
        bf16=True,
        report_to="wandb" if os.environ.get("WANDB_API_KEY") else "none",
        warmup_steps=10,
    )

    trainer = GRPOTrainer(
        model=model, args=config,
        reward_funcs=[reward_incident_resolution, reward_format_json],
        train_dataset=dataset, processing_class=tokenizer,
    )

    print("🚀 EVOLUTION START: Unsloth + GRPO active.")
    trainer.train()
    trainer.save_model("./incidentmind_final")
    print("✅ EVOLUTION COMPLETE.")

def _generate_final_plots(log_history):
    rewards = [x['reward'] for x in log_history if 'reward' in x]
    losses = [x['loss'] for x in log_history if 'loss' in x]
    
    plt.figure(figsize=(10, 5))
    plt.subplot(1, 2, 1)
    plt.plot(rewards, label='Mean Reward')
    plt.title('GRPO Reward Curve')
    plt.subplot(1, 2, 2)
    plt.plot(losses, label='Loss')
    plt.title('Training Loss')
    plt.savefig("./ai/outputs/reward_curves/real_training.png")

if __name__ == "__main__":
    main()
