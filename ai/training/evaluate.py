"""
Evaluation script — runs N episodes and reports aggregate metrics.
Used to compute before/after comparison numbers for the README.
"""

import os
import sys
import json
import argparse
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from environment.incident_env import IncidentMindEnv
from agent.sre_agent import SREAgent


def evaluate(agent_type: str = "trained", num_episodes: int = 20):
    env = IncidentMindEnv()
    agent = SREAgent(model_type=agent_type)

    results = {
        "agent_type": agent_type,
        "episodes": num_episodes,
        "rewards": [],
        "steps": [],
        "resolved_count": 0,
        "sla_met_count": 0,
        "wrong_fix_count": 0,
    }

    print(f"\n{'='*50}")
    print(f"  Evaluating {agent_type} agent — {num_episodes} episodes")
    print(f"{'='*50}\n")

    for ep in range(num_episodes):
        obs = env.reset()
        done = False
        episode_reward = 0.0
        steps = 0
        agent.reset()

        while not done and steps < 50:
            action, kwargs = agent.act(obs)
            obs, reward, done, info = env.step(action, **kwargs)
            episode_reward += reward
            steps += 1

        done_reason = info.get("done_reason", "max_steps")
        resolved = done_reason == "resolved"

        results["rewards"].append(round(episode_reward, 3))
        results["steps"].append(steps)
        if resolved:
            results["resolved_count"] += 1
        if obs.get("time_elapsed_minutes", 999) <= 30:
            results["sla_met_count"] += 1

        icon = "✅" if resolved else "❌"
        print(f"  Ep {ep+1:3d} | {icon} {done_reason:20s} | reward={episode_reward:+.3f} | steps={steps}")

    # Summary
    avg_reward = sum(results["rewards"]) / len(results["rewards"])
    avg_steps = sum(results["steps"]) / len(results["steps"])
    resolution_rate = results["resolved_count"] / num_episodes * 100
    sla_rate = results["sla_met_count"] / num_episodes * 100

    print(f"\n{'='*50}")
    print(f"  Results: {agent_type} agent")
    print(f"  Avg Reward:       {avg_reward:+.3f}")
    print(f"  Avg Steps:        {avg_steps:.1f}")
    print(f"  Resolution Rate:  {resolution_rate:.0f}%")
    print(f"  SLA Compliance:   {sla_rate:.0f}%")
    print(f"{'='*50}\n")

    # Save
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "outputs", "episodes")
    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, f"eval_{agent_type}.json"), "w") as f:
        json.dump({
            **results,
            "avg_reward": avg_reward,
            "avg_steps": avg_steps,
            "resolution_rate": resolution_rate,
            "sla_compliance": sla_rate,
            "timestamp": datetime.utcnow().isoformat()
        }, f, indent=2)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", type=str, default="trained", choices=["trained", "untrained"])
    parser.add_argument("--episodes", type=int, default=20)
    args = parser.parse_args()

    evaluate(agent_type=args.agent, num_episodes=args.episodes)
