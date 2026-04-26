import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const getSocketURL = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (window.location.hostname.endsWith('.hf.space')) return window.location.origin;
  return 'http://localhost:3000';
};
const SOCKET_URL = getSocketURL();

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [episodeResult, setEpisodeResult] = useState(null);
  const [error, setError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      setError(`Connection failed: ${err.message}`);
    });

    socket.on('agent-step', (step) => {
      setAgentSteps((prev) => [...prev, step]);
    });

    socket.on('agent-step-update', (data) => {
      setAgentSteps((prev) => {
        const newSteps = [...prev];
        if (data.index >= 0 && data.index < newSteps.length) {
          newSteps[data.index] = data;
        }
        return newSteps;
      });
      setPendingApproval(null);
    });

    socket.on('action-approval-required', (data) => {
      setPendingApproval(data);
    });

    socket.on('episode-complete', (result) => {
      setEpisodeResult(result);
      setIsRunning(false);
      setPendingApproval(null);
    });

    socket.on('error', (err) => {
      setError(err.message || 'Unknown socket error');
      setIsRunning(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const runEpisode = useCallback(({ incidentClass = 'random', agentType = 'trained' } = {}) => {
    if (!socketRef.current) return;
    setAgentSteps([]);
    setEpisodeResult(null);
    setError(null);
    setIsRunning(true);
    socketRef.current.emit('start-episode', { incidentClass, agentType });
  }, []);

  const resetEpisode = useCallback(() => {
    setAgentSteps([]);
    setEpisodeResult(null);
    setError(null);
    setIsRunning(false);
    setPendingApproval(null);
  }, []);

  const approveAction = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('action-approved');
  }, []);

  const denyAction = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('action-denied');
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
