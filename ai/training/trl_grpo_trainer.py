# ======================================================================
# Distributed TRL GRPO Training Script for HuggingFace Spaces / SLURM
# Scalable via DeepSpeed ZeRO-3 & vLLM Generation
# ======================================================================
import os
import argparse
import re
import json
import torch
from datasets import Dataset
from transformers import AutoTokenizer
from trl import GRPOConfig, GRPOTrainer
from environment.incident_env import IncidentMindEnv

# ---------------------------------------------------------
# Reward Function (Strictly matching TRL Signature)
# ---------------------------------------------------------
def compute_incident_rewards(prompts, completions, **kwargs):
    """
    Reward function that bridges OpenEnv Simulator to HuggingFace TRL.
    Must accept prompts, completions, and **kwargs.
    Must return a list of floats.
    """
    rewards = []
    
    # In a fully distributed setup, each process creates its own env instance temporarily
    # or you can use `environment_factory` natively in TRL. For this script, we loop.
    for prompt, completion in zip(prompts, completions):
        env = IncidentMindEnv()
        obs = env.reset()
        
        try:
            # Extract action block from completion
            # Assume LLM outputs <think>...</think> and then {"tool": "...", "args": {...}}
            json_match = re.search(r'\{[^{}]*"tool"[^{}]*\}', completion, re.DOTALL)
            if json_match:
                call = json.loads(json_match.group())
                action = call.get("tool", "invalid")
                action_kwargs = call.get("args", {})
            else:
                action, action_kwargs = "invalid", {}
        except Exception:
            action, action_kwargs = "error", {}

        # Step the custom simulator
        _, reward, _, _ = env.step(action, **action_kwargs)
        
        # Explicit cast to float as required by TRL
        rewards.append(float(reward))
        
    return rewards

# ---------------------------------------------------------
# Main Training Loop
# ---------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_id", type=str, default="Qwen/Qwen2.5-7B-Instruct", help="The HuggingFace Model ID")
    parser.add_argument("--vllm_server_host", type=str, default="", help="For external vllm-serve mode (SLURM)")
    parser.add_argument("--use_vllm", action="store_true", help="Enable vLLM backend for generation")
    args = parser.parse_args()

    print(f"Initializing Distributed GRPO Training for {args.model_id}...")

    # Set up tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Synthetic Dataset Bootstrap (In production, replace with real SRE tickets)
    system_prompt = "You are an expert SRE handling a live production incident. Respond with a JSON tool call."
    incidents = [
        "ALERT: P0 - Database connection pool exhausted on production-db-1",
        "ALERT: P1 - CPU spiked to 100% on pod api-gateway",
        "ALERT: P0 - Ingress rate limits exceeded, dropping 50% of traffic",
        "ALERT: P2 - Memory leak suspected in payment-service",
    ]
    
    # Format dataset as Conversational (Required for modern instruction-tuned models)
    formatted_data = {"prompt": []}
    for inc in incidents:
        formatted_data["prompt"].append([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": inc}
        ])
        
    dataset = Dataset.from_dict(formatted_data)

    # ---------------------------------------------------------
    # Strict GRPO Configuration (Matching TRL Docs Parameters)
    # ---------------------------------------------------------
    config_kwargs = {
        "output_dir": "./incidentmind_trained_model",
        "learning_rate": 1e-5,
        "per_device_train_batch_size": 2, # Fit on A10G/L4, scale with GPUs
        "gradient_accumulation_steps": 4, # Effective batch size = 2 * 4 * num_gpus
        "max_prompt_length": 512,
        "max_completion_length": 256,
        "num_generations": 8,            # Samples per prompt
        "logging_steps": 1,
        "save_steps": 20,
        "max_steps": 100,                # Demo scale, increase for real
        "bf16": True,                    # Required for modern Ampere+ GPUs
        "beta": 0.04,                    # KL divergence penalty
        "temperature": 0.8,
    }

    # Enable vLLM optimizations if requested (Crucial for 7B+ models)
    if args.use_vllm:
        config_kwargs["use_vllm"] = True
        
        # If parsing a SLURM multi-node environment
        if args.vllm_server_host:
            config_kwargs["vllm_mode"] = "server"
            config_kwargs["vllm_server_host"] = args.vllm_server_host.replace("ip-", "").replace("-", ".")
        else:
            config_kwargs["vllm_mode"] = "colocate"
            config_kwargs["vllm_gpu_memory_utilization"] = 0.4
            # Important: ensure ds3_gather_for_generation is false if using vLLM in colocate mode with ZeRO3
            config_kwargs["ds3_gather_for_generation"] = False 

    training_args = GRPOConfig(**config_kwargs)

    # ---------------------------------------------------------
    # Trainer Initialization
    # ---------------------------------------------------------
    trainer = GRPOTrainer(
        model=args.model_id,               # Pass string directly, TRL handles loading via HF/Accelerate
        args=training_args,
        reward_funcs=[compute_incident_rewards], # Must be a list or single function
        train_dataset=dataset,
        processing_class=tokenizer,
    )

    # Execute
    print("🚀 Firing up GRPOTrainer...")
    trainer.train()
    
    # Save the final policy
    trainer.save_model("./incidentmind_final_policy")
    print("✅ Training complete. RL Policy weights saved.")

if __name__ == "__main__":
    main()
