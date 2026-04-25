FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# Install Python and pip
RUN apt-get update && apt-get install -y python3-pip git curl && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/bin/python

# Create working directory
WORKDIR /app

# Install pip requirements first
COPY requirements.txt .
RUN pip install torch transformers>=4.48.0 trl accelerate deepspeed vllm datasets
RUN pip install -r requirements.txt

# Copy all project files
COPY . .

# Set up the command explicitly mapped to accelerate
CMD ["accelerate", "launch", "--config_file", "accelerate_configs/deepspeed_zero3.yaml", "ai/training/trl_grpo_trainer.py", "--model_id", "Qwen/Qwen2.5-1.5B-Instruct"]
