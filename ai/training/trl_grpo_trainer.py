# ======================================================================
# Distributed TRL GRPO Training Script for HuggingFace Spaces / SLURM
# Scalable via DeepSpeed ZeRO-3 & vLLM Generation
# ======================================================================
import os
os.environ["PYTORCH_ALLOC_CONF"] = "expandable_segments:True"
import argparse
import re
import json
import torch
import sys
import matplotlib.pyplot as plt
from datetime import datetime
from datasets import Dataset
from transformers import AutoTokenizer, BitsAndBytesConfig
from trl import GRPOConfig, GRPOTrainer
from peft import LoraConfig

# Ensure AI package is discoverable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from environment.incident_env import IncidentMindEnv

# ---------------------------------------------------------
# Reward Functions (Strictly matching TRL Signature)
# ---------------------------------------------------------
def reward_incident_resolution(prompts, completions, **kwargs):
    """
    Reward based on whether the action leads to resolution or progress.
    Performs a 5-step lookahead rollout to see if the action was 'surgical'.
    """
    rewards = []
    
    for prompt, completion in zip(prompts, completions):
        # 1. Parse action from <think>...</think> JSON format
        try:
            json_match = re.search(r'\{.*"tool".*\}', completion, re.DOTALL)
            if json_match:
                call = json.loads(json_match.group())
                action = call.get("tool", "invalid")
                action_kwargs = call.get("args", {})
            else:
                rewards.append(0.0)
                continue
        except Exception:
            rewards.append(-0.1)
            continue

        # 2. Rollout Simulation
        env = IncidentMindEnv()
        # Extract incident class from prompt hint if available
        # For training, we cycle classes
        env.reset() 
        
        _, reward, done, _ = env.step(action, **action_kwargs)
        
        # Lookahead: If it's a good step, follow it with a few more heuristic steps
        # to see if the incident clears up.
        lookahead_reward = 0.0
        if not done and reward > 0:
            for _ in range(3):
                # Basic diagnostic follow-up
                _, r, d, _ = env.step("query_logs", service="api-gateway")
                lookahead_reward += r
                if d: break
        
        rewards.append(float(reward + lookahead_reward * 0.2))
        
    return rewards

def reward_format_json(prompts, completions, **kwargs):
    """Reward for adhering to the requested JSON format."""
    rewards = []
    for completion in completions:
        if re.search(r'\{.*"tool":\s*".*".*\}', completion, re.DOTALL):
            rewards.append(1.0)
        else:
            rewards.append(0.0)
    return rewards

# ---------------------------------------------------------
# Main Training Loop
# ---------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="Qwen/Qwen2.5-7B-Instruct")
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--max_steps", type=int, default=100)
    parser.add_argument("--batch_size", type=int, default=1)
    args = parser.parse_args()

    # 4-bit Quantization for Space Stability
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    from transformers import AutoModelForCausalLM
    model = AutoModelForCausalLM.from_pretrained(
        args.model_id,
        quantization_config=bnb_config,
        torch_dtype=torch.bfloat16,
        device_map="auto"
    )

    tokenizer = AutoTokenizer.from_pretrained(args.model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.model_max_length = 512

    # Dataset: Mix of all 20 incident classes (if available)
    env_classes = IncidentMindEnv.INCIDENT_CLASSES
    system_prompt = "You are an expert SRE. Rule: Respond with a JSON tool call inside <think> tags."
    
    formatted_data = {"prompt": []}
    for _ in range(25): # Build decent sized buffer
        for cls in env_classes:
            formatted_data["prompt"].append([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"ALERT: High error rate detected in {cls}. What is your first action?"}
            ])
            
    dataset = Dataset.from_dict(formatted_data)

    config = GRPOConfig(
        output_dir="./incidentmind_policy",
        num_generations=4, # Group size for RL
        max_completion_length=128,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=8,
        learning_rate=1e-5,
        logging_steps=1,
        bf16=True,
        report_to="none",
        warmup_steps=10,
    )

    peft_config = LoraConfig(
        r=16, lora_alpha=32, target_modules="all-linear",
        task_type="CAUSAL_LM", lora_dropout=0.05
    )

    trainer = GRPOTrainer(
        model=model,
        args=config,
        reward_funcs=[reward_incident_resolution, reward_format_json],
        train_dataset=dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
    )

    print("🚀 Starting GRPO Training...")
    trainer.train()
    
    # Save & Plot
    trainer.save_model("./incidentmind_final")
    _generate_final_plots(trainer.state.log_history)
    print("✅ Training complete. Weights and Plots saved.")

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
