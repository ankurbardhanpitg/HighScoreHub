import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const GAME_EXPAND_MS = 520;

export function useGameExpand({ playState, isGameOver = false, onPause } = {}) {
  const navigate = useNavigate();
  const leaveTimerRef = useRef(null);
  const onPauseRef = useRef(onPause);
  const [leaving, setLeaving] = useState(false);

  onPauseRef.current = onPause;

  const isExpanded =
    !leaving &&
    (playState === 'playing' ||
      playState === 'paused' ||
      playState === 'won' ||
      playState === 'ended' ||
      Boolean(isGameOver));

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  function handleQuit(event) {
    event?.preventDefault();
    event?.stopPropagation();

    if (leaveTimerRef.current) {
      return;
    }

    onPauseRef.current?.();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isExpanded || reduceMotion) {
      navigate('/games');
      return;
    }

    setLeaving(true);
    leaveTimerRef.current = window.setTimeout(() => {
      navigate('/games');
    }, GAME_EXPAND_MS);
  }

  return { isExpanded, handleQuit };
}
