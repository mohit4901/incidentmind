"""
FastAPI microservice — Node.js backend calls this for:
1. Running single episodes (live demo)
2. Starting training runs (50+ epochs)
3. Getting training status
4. Getting results / reward curves
"""

from fastapi import FastAPI, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import json
import os
import sys

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from environment.incident_env import IncidentMindEnv
from agent.sre_agent import SREAgent

app = FastAPI(title="IncidentMind AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global training state
training_state = {
    "running": False,
    "current_epoch": 0,
    "total_epochs": 50,
    "reward_history": [],
    "status": "idle",
    "current_episode": None,
    "logs": []
}


class EpisodeRequest(BaseModel):
    incident_class: str = "random"
    max_steps: int = 50
    agent_type: str = "trained"  # "trained" or "untrained"


class TrainingRequest(BaseModel):
    num_epochs: int = 50
    model_name: str = "Qwen/Qwen2.5-7B-Instruct"


@app.get("/")
def root():
    return {
        "status": "active", 
        "message": "IncidentMind AI Engine Online",
        "version": "1.1.0 (RL-Enabled)"
    }

@app.get("/ping")
def ping():
    """Keep-alive endpoint for HuggingFace Spaces."""
    return {"status": "pong", "timestamp": asyncio.get_event_loop().time()}

@app.get("/health")
def health():
    return {"status": "ok", "service": "incidentmind-ai"}


@app.post("/run-episode")
def run_episode(request: EpisodeRequest):
    """Run a single episode and return the full trajectory."""
    env = IncidentMindEnv()
    agent = SREAgent(model_type=request.agent_type)
    
    obs = env.reset(forced_class=request.incident_class)
    trajectory = []
    done = False
    step = 0
    
    while not done and step < request.max_steps:
        action, kwargs = agent.act(obs)
        new_obs, reward, done, info = env.step(action, **kwargs)
        
        trajectory.append({
            "step": step + 1,
            "action": action,
            "kwargs": kwargs,
            "reward": reward,
            "cumulative_reward": sum(t["reward"] for t in trajectory) + reward,
            "observation_summary": {
                "time_elapsed": new_obs.get("time_elapsed_minutes", 0),
                "action_history_len": len(new_obs.get("action_history", [])),
                "hypothesis_count": len(new_obs.get("hypothesis_log", [])),
            }
        })
        
        obs = new_obs
        step += 1
    
    return {
        "trajectory": trajectory,
        "final_reward": sum(t["reward"] for t in trajectory),
        "steps_taken": step,
        "incident_class": obs.get("alert", {}).get("title", "unknown"),
        "resolved": done and info.get("done_reason") == "resolved",
        "done_reason": info.get("done_reason", "unknown")
    }

@app.websocket("/ws/run-episode")
async def websocket_run_episode(websocket: WebSocket):
    await websocket.accept()
    
    try:
        data = await websocket.receive_text()
        request_data = json.loads(data)
        incident_class = request_data.get("incident_class", "random")
        agent_type = request_data.get("agent_type", "trained")
        max_steps = request_data.get("max_steps", 50)
        
        env = IncidentMindEnv()
        agent = SREAgent(model_type=agent_type)
        
        obs = env.reset(forced_class=incident_class)
        trajectory = []
        done = False
        step = 0
        final_reward = 0.0
        
        while not done and step < max_steps:
            action, kwargs = agent.act(obs)
            
            if action == "execute_fix":
                # Pause and ask for approval
                step_data = {
                    "step": step + 1,
                    "action": action,
                    "kwargs": kwargs,
                    "pending_approval": True,
                    "reward": 0.0,
                    "cumulative_reward": final_reward
                }
                await websocket.send_text(json.dumps({"type": "step", "step": step_data}))
                
                decision = await websocket.receive_text()
                if decision == "denied":
                    done = True
                    info = {"done_reason": "Rejected by Human Operator"}
                    final_reward -= 1.0
                    denied_step = step_data.copy()
                    denied_step["reward"] = -1.0
                    denied_step["cumulative_reward"] = final_reward
                    denied_step["status"] = "denied"
                    denied_step.pop("pending_approval")
                    trajectory.append(denied_step)
                    await websocket.send_text(json.dumps({"type": "step", "step": denied_step}))
                    break
            
            new_obs, reward, done, info = env.step(action, **kwargs)
            final_reward += reward
            
            step_record = {
                "step": step + 1,
                "action": action,
                "kwargs": kwargs,
                "reward": reward,
                "cumulative_reward": final_reward,
                "observation_summary": {
                    "time_elapsed": new_obs.get("time_elapsed_minutes", 0),
                    "action_history_len": len(new_obs.get("action_history", [])),
                    "hypothesis_count": len(new_obs.get("hypothesis_log", [])),
                }
            }
            if action == "execute_fix":
                step_record["status"] = "approved"
                
            trajectory.append(step_record)
            
            # Send step (but if it was pending_approval, this is the update)
            await websocket.send_text(json.dumps({"type": "step", "step": step_record}))
            
            obs = new_obs
            step += 1
            
        await websocket.send_text(json.dumps({
            "type": "complete",
            "result": {
                "trajectory": trajectory,
                "final_reward": final_reward,
                "steps_taken": step,
                "incident_class": env.current_incident_class if hasattr(env, 'current_incident_class') else incident_class,
                "resolved": done and info.get("done_reason") == "resolved",
                "done_reason": info.get("done_reason", "unknown")
            }
        }))
    except WebSocketDisconnect:
        print("WebSocket client disconnected prematurely")
        pass


@app.post("/start-training")
async def start_training(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Start RL training in background."""
    if training_state["running"]:
        return {"error": "Training already running"}
    
    training_state["running"] = True
    training_state["current_epoch"] = 0
    training_state["total_epochs"] = request.num_epochs
    training_state["reward_history"] = []
    training_state["status"] = "training"
    training_state["logs"] = []
    
    background_tasks.add_task(run_training_task, request.num_epochs)
    
    return {"status": "training_started", "epochs": request.num_epochs}


@app.get("/training-status")
def training_status():
    return {
        "running": training_state["running"],
        "current_epoch": training_state["current_epoch"],
        "total_epochs": training_state["total_epochs"],
        "progress_percent": round(
            (training_state["current_epoch"] / max(training_state["total_epochs"], 1)) * 100, 1
        ),
        "reward_history": training_state["reward_history"],
        "status": training_state["status"],
        "latest_logs": training_state["logs"][-20:],
    }


@app.get("/results")
def get_results():
    """Get training results including before/after comparison."""
    if not training_state["reward_history"]:
        return {"error": "No training results yet"}
    
    rewards = training_state["reward_history"]
    early_rewards = rewards[:min(5, len(rewards))]
    late_rewards = rewards[max(0, len(rewards)-5):]
    
    return {
        "total_epochs": len(rewards),
        "initial_avg_reward": round(sum(early_rewards) / len(early_rewards), 3) if early_rewards else 0,
        "final_avg_reward": round(sum(late_rewards) / len(late_rewards), 3) if late_rewards else 0,
        "improvement": round(
            (sum(late_rewards) / len(late_rewards)) - (sum(early_rewards) / len(early_rewards)), 3
        ) if early_rewards and late_rewards else 0,
        "reward_curve": rewards,
        "best_reward": max(rewards),
        "worst_reward": min(rewards),
    }


async def run_training_task(num_epochs: int):
    """Background training task — updates global state."""
    try:
        env = IncidentMindEnv()
        agent = SREAgent(model_type="trained")
        
        for epoch in range(num_epochs):
            training_state["current_epoch"] = epoch + 1
            
            # Run one training episode
            obs = env.reset()
            done = False
            episode_reward = 0
            step = 0
            agent.reset()
            
            while not done and step < 50:
                action, kwargs = agent.act(obs)
                obs, reward, done, info = env.step(action, **kwargs)
                episode_reward += reward
                step += 1
            
            training_state["reward_history"].append(round(episode_reward, 3))
            training_state["logs"].append(
                f"Epoch {epoch+1}/{num_epochs}: reward={episode_reward:.3f}, steps={step}, done={info.get('done_reason', 'max_steps')}"
            )
            
            # Save reward curve plot logic would go here
            if (epoch + 1) % 10 == 0:
                _save_reward_curve(training_state["reward_history"])
            
            await asyncio.sleep(0.1)  # Allow other requests
        
        training_state["running"] = False
        training_state["status"] = "complete"
        _save_reward_curve(training_state["reward_history"])
        
    except Exception as e:
        training_state["running"] = False
        training_state["status"] = f"error: {str(e)}"
        print(f"Training error: {e}")


def _save_reward_curve(rewards: list):
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        plt.figure(figsize=(10, 5))
        plt.plot(rewards, color='#1D9E75', linewidth=2, label='Episode Reward')
        
        # Rolling average
        if len(rewards) >= 5:
            window = 5
            rolling = [sum(rewards[max(0,i-window):i+1])/min(i+1,window) for i in range(len(rewards))]
            plt.plot(rolling, color='#534AB7', linewidth=2, linestyle='--', label='Rolling Avg (5)')
        
        plt.xlabel('Training Epoch', fontsize=12)
        plt.ylabel('Episode Reward', fontsize=12)
        plt.title('IncidentMind — Agent Learning Curve', fontsize=14)
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "outputs", "reward_curves")
        os.makedirs(output_dir, exist_ok=True)
        plt.savefig(os.path.join(output_dir, "latest.png"), dpi=150, bbox_inches='tight')
        plt.close()
    except Exception as e:
        print(f"Could not save plot: {e}")
