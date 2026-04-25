import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [episodeResult, setEpisodeResult] = useState(null);
  const [error, setError] = useState(null);

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

    socket.on('episode-complete', (result) => {
      setEpisodeResult(result);
      setIsRunning(false);
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
  }, []);

  return {
    connected,
    agentSteps,
    isRunning,
    episodeResult,
    error,
    runEpisode,
    resetEpisode,
  };
}
