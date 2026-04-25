"""
PPO training alternative — placeholder for TRL PPOTrainer integration.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.train_grpo import run_training


def run_ppo_training(num_epochs: int = 50):
    """
    PPO alternative training script.
    Currently delegates to the same GRPO-style training loop.
    
    For full PPO with TRL:
    1. pip install trl transformers
    2. Use PPOTrainer with custom reward model
    3. See notebooks/training_colab.ipynb for full implementation
    """
    print("PPO Training — using GRPO-compatible loop")
    return run_training(num_epochs=num_epochs)


if __name__ == "__main__":
    run_ppo_training(50)
