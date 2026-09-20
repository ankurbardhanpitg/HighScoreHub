import { useCallback, useEffect, useRef, useState } from 'react';
import { getLudoPlayerId, ludoWsUrl } from '../game/ludoRoom.js';

export function useLudoRoom(roomId, name) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const nameRef = useRef(name);
  nameRef.current = name;

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!roomId) {
      return undefined;
    }

    let stopped = false;
    let fatal = false;
    let retryTimer = 0;
    let retries = 0;
    let ws;

    function connect() {
      if (stopped || fatal) {
        return;
      }

      ws = new WebSocket(ludoWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        retries = 0;
        setConnected(true);
        setError('');
        ws.send(
          JSON.stringify({
            type: 'join',
            roomId,
            playerId: getLudoPlayerId(),
            name: nameRef.current,
          }),
        );
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'state') {
          setSnapshot(msg);
          setError('');
          return;
        }

        if (msg.type === 'error') {
          setError(msg.message || 'Something went wrong');
          if (msg.fatal) {
            fatal = true;
            ws.close();
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (stopped || fatal) {
          return;
        }
        retries += 1;
        if (retries > 10) {
          setError('Lost the connection. Refresh to try again.');
          return;
        }
        retryTimer = window.setTimeout(connect, Math.min(400 * 2 ** retries, 4000));
      };
    }

    connect();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, [roomId]);

  return {
    snapshot,
    error,
    connected,
    sendRoll: () => send({ type: 'roll' }),
    sendMove: (tokenIndex) => send({ type: 'move', tokenIndex }),
    startMatch: () => send({ type: 'start' }),
    resign: () => send({ type: 'resign' }),
    rematch: () => send({ type: 'rematch' }),
  };
}
