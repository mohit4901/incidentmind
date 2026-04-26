import { useEffect, useRef, useState, useCallback } from 'react';

const getBaseURL = () => {
  const { hostname, origin } = window.location;
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  const HF_URL = 'https://CottonCloud-incidentmind-grpo-training.hf.space';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return HF_URL;
  return origin;
};

const WS_URL = getBaseURL().replace(/^http/, 'ws') + '/ws/run-episode';

export function useSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [episodeResult, setEpisodeResult] = useState(null);
  const [error, setError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      console.log("[SOCKET] Connected to", WS_URL);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'step':
          setAgentSteps((prev) => [...prev, data.step]);
          setPendingApproval(null);
          break;
        case 'approval_required':
          setPendingApproval(data.data);
          break;
        case 'episode_complete':
          setEpisodeResult(data.result);
          setIsRunning(false);
          setPendingApproval(null);
          break;
        case 'error':
          setError(data.message);
          setIsRunning(false);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[SOCKET] Disconnected");
      // Optional: Auto-reconnect after 3s
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error("[SOCKET] Error:", err);
      setError("Connection lost. Retrying...");
    };
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const runEpisode = useCallback(({ incidentClass = 'random', agentType = 'trained' } = {}) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
        setError("Not connected to AI Bridge");
        return;
    }
    setAgentSteps([]);
    setEpisodeResult(null);
    setError(null);
    setIsRunning(true);
    
    wsRef.current.send(JSON.stringify({
      incident_class: incidentClass,
      agent_type: agentType,
      max_steps: 50
    }));
  }, []);

  const resetEpisode = useCallback(() => {
    setAgentSteps([]);
    setEpisodeResult(null);
    setError(null);
    setIsRunning(false);
    setPendingApproval(null);
  }, []);

  const approveAction = useCallback(() => {
    wsRef.current?.send("approved");
  }, []);

  const denyAction = useCallback(() => {
    wsRef.current?.send("denied");
  }, []);

  return {
    connected,
    agentSteps,
    isRunning,
    episodeResult,
    error,
    pendingApproval,
    runEpisode,
    resetEpisode,
    approveAction,
    denyAction,
  };
}
