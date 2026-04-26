FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# Install Python and pip
RUN apt-get update && apt-get install -y python3-pip git curl && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/bin/python

# Create working directory
WORKDIR /app

ENV PYTORCH_ALLOC_CONF="expandable_segments:True"

# Install pip requirements first
COPY ai/requirements.txt requirements.txt
RUN pip install torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
RUN pip install transformers>=4.48.0 trl accelerate deepspeed vllm datasets peft bitsandbytes wandb
RUN pip install -r requirements.txt

# Copy all project files
COPY . .

ENV PYTHONUNBUFFERED=1

# Expose port for Hugging Face Spaces
EXPOSE 7860

# Run the FastAPI microservice using python -m to guarantee module path resolution
CMD ["python", "-m", "uvicorn", "ai.api.main:app", "--host", "0.0.0.0", "--port", "7860"]
