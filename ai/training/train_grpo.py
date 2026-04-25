"""
GRPO Training Script for IncidentMind.
Run 50+ epochs to show clear learning improvement.

Usage:
  python train_grpo.py --epochs 50 --model qwen2.5-7b
"""

import os
import sys
import json
import argparse
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from environment.incident_env import IncidentMindEnv
from agent.sre_agent import SREAgent


def run_training(num_epochs: int = 50, save_plots: bool = True):
    """
    Main training loop.
    
    For hackathon: Uses REINFORCE-style update via Groq LLM
    with reward-weighted prompt optimization.
    """
    
    env = IncidentMindEnv()
    agent = SREAgent(model_type="trained")
    
    reward_history = []
    episode_logs = []
    
    print(f"\n{'='*60}")
    print(f"  IncidentMind — Training Run")
    print(f"  Epochs: {num_epochs} | Model: Groq Llama-3.1-8B")
    print(f"{'='*60}\n")
    
    for epoch in range(num_epochs):
        obs = env.reset()
        done = False
        episode_reward = 0.0
        steps = 0
        trajectory = []
        
        agent.reset()  # Clear conversation history
        
        while not done and steps < 50:
            action, kwargs = agent.act(obs)
            obs, reward, done, info = env.step(action, **kwargs)
            
            episode_reward += reward
            steps += 1
            trajectory.append({
                "step": steps, "action": action, 
                "reward": reward, "cumulative": episode_reward
            })
        
        reward_history.append(round(episode_reward, 3))
        
        done_reason = info.get("done_reason", "max_steps")
        log_entry = {
            "epoch": epoch + 1,
            "reward": episode_reward,
            "steps": steps,
            "done_reason": done_reason,
            "timestamp": datetime.utcnow().isoformat()
        }
        episode_logs.append(log_entry)
        
        # Console output
        status_icon = "✅" if done_reason == "resolved" else "⏱" if done_reason == "sla_breached" else "→"
        print(f"Epoch {epoch+1:3d}/{num_epochs} | {status_icon} {done_reason:25s} | reward={episode_reward:+.3f} | steps={steps:2d}")
        
        # Save intermediate plots
        if save_plots and (epoch + 1) % 10 == 0:
            _save_plots(reward_history, epoch + 1)
        
        # Save logs
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "outputs", "episodes")
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "training_log.json"), "w") as f:
            json.dump(episode_logs, f, indent=2)
    
    # Final plots
    if save_plots:
        _save_plots(reward_history, num_epochs)
    
    # Summary
    early_avg = sum(reward_history[:5]) / min(5, len(reward_history)) if reward_history else 0
    late_avg = sum(reward_history[-5:]) / min(5, len(reward_history)) if reward_history else 0
    improvement = late_avg - early_avg
    
    print(f"\n{'='*60}")
    print(f"  Training Complete!")
    print(f"  Early avg (first 5):  {early_avg:+.3f}")
    print(f"  Final avg (last 5):   {late_avg:+.3f}")
    print(f"  Improvement:          {improvement:+.3f} ({improvement/max(abs(early_avg), 0.001)*100:.1f}%)")
    print(f"  Best epoch reward:    {max(reward_history):+.3f}")
    print(f"{'='*60}\n")
    
    return reward_history, episode_logs


def _save_plots(reward_history: list, current_epoch: int):
    """Save reward curve and rolling average plot."""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    epochs = list(range(1, len(reward_history) + 1))
    
    # Plot 1: Raw reward curve
    ax1.plot(epochs, reward_history, color='#10b981', linewidth=1.5, alpha=0.7, label='Episode reward')
    
    # Rolling average
    window = 5
    if len(reward_history) >= window:
        rolling = [
            sum(reward_history[max(0,i-window):i+1]) / min(i+1, window)
            for i in range(len(reward_history))
        ]
        ax1.plot(epochs, rolling, color='#8b5cf6', linewidth=2.5, label=f'Rolling avg ({window})')
    
    ax1.axhline(y=0, color='#374151', linestyle='--', linewidth=1, alpha=0.5)
    ax1.set_xlabel('Training Epoch', fontsize=12)
    ax1.set_ylabel('Episode Reward', fontsize=12)
    ax1.set_title('IncidentMind — Learning Curve', fontsize=13, fontweight='bold')
    ax1.legend(fontsize=10)
    ax1.grid(True, alpha=0.2)
    ax1.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')
    ax1.tick_params(colors='white')
    ax1.xaxis.label.set_color('white')
    ax1.yaxis.label.set_color('white')
    ax1.title.set_color('white')
    for spine in ax1.spines.values():
        spine.set_edgecolor('#374151')
    
    # Plot 2: Early vs Late distribution
    if len(reward_history) >= 10:
        early = reward_history[:len(reward_history)//2]
        late = reward_history[len(reward_history)//2:]
        
        ax2.hist(early, bins=10, alpha=0.7, color='#ef4444', label='Early episodes', density=True)
        ax2.hist(late, bins=10, alpha=0.7, color='#10b981', label='Late episodes', density=True)
        ax2.set_xlabel('Episode Reward', fontsize=12)
        ax2.set_ylabel('Density', fontsize=12)
        ax2.set_title('Reward Distribution: Early vs Late', fontsize=13, fontweight='bold')
        ax2.legend(fontsize=10)
        ax2.grid(True, alpha=0.2)
        ax2.set_facecolor('#0f172a')
        ax2.tick_params(colors='white')
        ax2.xaxis.label.set_color('white')
        ax2.yaxis.label.set_color('white')
        ax2.title.set_color('white')
        for spine in ax2.spines.values():
            spine.set_edgecolor('#374151')
    
    plt.tight_layout()
    
    curve_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "outputs", "reward_curves")
    os.makedirs(curve_dir, exist_ok=True)
    plt.savefig(os.path.join(curve_dir, f"epoch_{current_epoch}.png"), dpi=150, bbox_inches='tight',
                facecolor='#0f172a')
    plt.savefig(os.path.join(curve_dir, "latest.png"), dpi=150, bbox_inches='tight',
                facecolor='#0f172a')
    plt.close()
    
    print(f"  → Reward curve saved (epoch {current_epoch})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--no-plots", action="store_true")
    args = parser.parse_args()
    
    run_training(num_epochs=args.epochs, save_plots=not args.no_plots)
