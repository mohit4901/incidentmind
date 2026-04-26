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
try:
    from unsloth import FastLanguageModel, PatchGRPO
    USE_UNSLOTH = True
    PatchGRPO() 
except ImportError:
    USE_UNSLOTH = False
    from peft import LoraConfig
    from transformers import BitsAndBytesConfig, AutoModelForCausalLM

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
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="unsloth/Qwen2.5-7B-Instruct-bnb-4bit")
    parser.add_argument("--max_steps", type=int, default=100)
    args = parser.parse_args()

    # Device Discovery: CUDA (NVIDIA), MPS (Apple Silicon), or CPU
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    print(f"[{datetime.now()}] Compute Engine: {device.upper()}")

    if USE_UNSLOTH:
        # UNSLOTH PEFT Loading (Works primarily on NVIDIA)
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
    else:
        # Standard LoRA / MPS Fallback
        bnb_config = None
        if device == "cuda":
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
            )
        
        model = AutoModelForCausalLM.from_pretrained(
            args.model_id,
            quantization_config=bnb_config,
            torch_dtype=torch.float16 if device == "mps" else torch.bfloat16,
            device_map={"": device} if device != "cpu" else "auto"
        )
        
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(args.model_id)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        peft_config = LoraConfig(
            r=16, lora_alpha=32, target_modules="all-linear",
            task_type="CAUSAL_LM", lora_dropout=0.05
        )
        # We wrap model in peft here or let trainer do it

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
        peft_config=peft_config if not USE_UNSLOTH else None,
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
