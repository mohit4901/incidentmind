"""
IncidentMind Evaluation Script.
Compares Untrained (Random) vs Trained (LLM/RL) models across 10 episodes.
"""
import os
import sys
import pandas as pd
from datetime import datetime

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from environment.incident_env import IncidentMindEnv
from agent.sre_agent import SREAgent

def run_eval(model_type="untrained", num_episodes=5):
    env = IncidentMindEnv()
    agent = SREAgent(model_type=model_type)
    
    results = []
    
    print(f"\n--- Evaluating {model_type.upper()} Model ({num_episodes} episodes) ---")
    
    for i in range(num_episodes):
        obs = env.reset()
        done = False
        total_reward = 0
        steps = 0
        agent.reset()
        
        while not done and steps < 30:
            action, kwargs = agent.act(obs)
            obs, reward, done, info = env.step(action, **kwargs)
            total_reward += reward
            steps += 1
            
        done_reason = info.get("done_reason", "max_steps")
        resolved = (done_reason == "resolved")
        
        results.append({
            "episode": i + 1,
            "reward": total_reward,
            "steps": steps,
            "resolved": resolved,
            "reason": done_reason
        })
        print(f"Episode {i+1}: {'✅' if resolved else '❌'} | Reward: {total_reward:+.2f} | Steps: {steps}")
        
    return results

def main():
    untrained_results = run_eval("untrained", 5)
    trained_results = run_eval("trained", 5)
    
    u_df = pd.DataFrame(untrained_results)
    t_df = pd.DataFrame(trained_results)
    
    print(f"\n{'='*40}")
    print(f"       INCIDENTMIND EVALUATION")
    print(f"{'='*40}")
    print(f"METRIC            UNTRAINED    TRAINED")
    print(f"----------------------------------------")
    print(f"Avg Reward        {u_df['reward'].mean():+9.2f}    {t_df['reward'].mean():+9.2f}")
    print(f"Resolution Rate   {u_df['resolved'].mean()*100:8.1f}%    {t_df['resolved'].mean()*100:8.1f}%")
    print(f"Avg Steps         {u_df['steps'].mean():9.1f}    {t_df['steps'].mean():9.1f}")
    print(f"{'='*40}")
    
    # Save comparison to markdown for judges
    with open("eval_results.md", "w") as f:
        f.write("# IncidentMind Evaluation Results\n\n")
        f.write("| Metric | Untrained (Baseline) | Trained (RL-SRE) | Improvement |\n")
        f.write("|---|---|---|---|\n")
        imp_reward = t_df['reward'].mean() - u_df['reward'].mean()
        imp_res = (t_df['resolved'].mean() - u_df['resolved'].mean()) * 100
        f.write(f"| Avg Reward | {u_df['reward'].mean():.2f} | {t_df['reward'].mean():.2f} | **{imp_reward:+.2f}** |\n")
        f.write(f"| Res. Rate | {u_df['resolved'].mean()*100:.1f}% | {t_df['resolved'].mean()*100:.1f}% | **{imp_res:+.1f}%** |\n")
        f.write(f"| Avg Steps | {u_df['steps'].mean():.1f} | {t_df['steps'].mean():.1f} | **{u_df['steps'].mean()-t_df['steps'].mean():.1f} fewer** |\n")

if __name__ == "__main__":
    main()
