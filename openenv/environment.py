"""
OpenEnv Environment base class — stub for IncidentMind hackathon project.
Provides the interface that IncidentMindEnv inherits from.
"""


class Environment:
    """Base class for all OpenEnv environments."""

    name: str = ""
    description: str = ""
    version: str = "1.0.0"

    def reset(self, **kwargs) -> dict:
        raise NotImplementedError

    def step(self, action: str, **kwargs):
        raise NotImplementedError

    def state(self) -> dict:
        raise NotImplementedError

    def render(self, mode: str = "human"):
        pass

    def close(self):
        pass
