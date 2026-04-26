"""
IncidentMind — The SRE Duel.
Generates comparative metrics (Untrained vs Trained) for the 'Downtime Saved' dashboard.
"""
import os
import sys
import json
import random

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from environment.incident_env import IncidentMindEnv
from agent.sre_agent import SREAgent

def run_duel(num_episodes=5):
    env = IncidentMindEnv()
    
    agents = {
        "untrained": SREAgent(model_type="untrained"),
        "trained": SREAgent(model_type="trained")
    }
    
    comparisons = []
    
    print(f"⚔️ Starting SRE Duel ({num_episodes} incidents)...")
    
    for i in range(num_episodes):
        incident_cls = random.choice(env.INCIDENT_CLASSES)
        print(f"Incident {i+1}: {incident_cls}")
        
        episode_data = {"incident": incident_cls, "results": {}}
        
        for name, agent in agents.items():
            obs = env.reset(forced_class=incident_cls)
            done = False
            reward = 0
            steps = 0
            agent.reset()
            
            while not done and steps < 30:
                action, kwargs = agent.act(obs)
                obs, r, done, info = env.step(action, **kwargs)
                reward += r
                steps += 1
            
            # $10,000 cost per step for downtime simulation
            # Trained agent saves more $ by resolving faster
            downtime_cost = steps * 10000 
            if not (done and info.get("done_reason") == "resolved"):
                downtime_cost += 500000 # Massive penalty for failure
                
            episode_data["results"][name] = {
                "reward": round(reward, 2),
                "steps": steps,
                "resolved": done and info.get("done_reason") == "resolved",
                "downtime_cost": downtime_cost
            }
            
        comparisons.append(episode_data)
        
    # Final aggregate
    final_report = {
        "episodes": comparisons,
        "summary": {
            "trained_total_saved": sum(c["results"]["untrained"]["downtime_cost"] - c["results"]["trained"]["downtime_cost"] for c in comparisons),
            "resolution_delta": (sum(1 for c in comparisons if c["results"]["trained"]["resolved"]) / num_episodes) - 
                               (sum(1 for c in comparisons if c["results"]["untrained"]["resolved"]) / num_episodes)
        }
    }
    
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ai/outputs/duel_results.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(final_report, f, indent=2)
        
    print(f"✅ Duel complete. Total Downtime Saved: ${final_report['summary']['trained_total_saved']:,}")

if __name__ == "__main__":
    run_duel()
