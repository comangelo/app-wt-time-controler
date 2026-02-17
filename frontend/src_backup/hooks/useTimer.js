import { useState, useRef, useCallback } from 'react';
import { addSecondsToDate } from '../utils/timeFormatters';

export function useTimer(totalDuration = 3600) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [remainingTime, setRemainingTime] = useState(totalDuration);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const timerRef = useRef(null);

  const startTimer = useCallback(() => {
    if (!isTimerRunning) {
      const now = new Date();
      if (!startTime) {
        setStartTime(now);
        setEndTime(addSecondsToDate(now, totalDuration));
      }
      setIsTimerRunning(true);
    }
  }, [isTimerRunning, startTime, totalDuration]);

  const pauseTimer = useCallback(() => {
    setIsTimerRunning(false);
  }, []);

  const toggleTimer = useCallback(() => {
    if (isTimerRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }, [isTimerRunning, startTimer, pauseTimer]);

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setElapsedTime(0);
    setRemainingTime(totalDuration);
    setStartTime(null);
    setEndTime(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [totalDuration]);

  const startFromTime = useCallback((cumulativeSeconds) => {
    const now = new Date();
    const virtualStartTime = new Date(now.getTime() - cumulativeSeconds * 1000);
    
    setElapsedTime(Math.floor(cumulativeSeconds));
    setRemainingTime(totalDuration - Math.floor(cumulativeSeconds));
    setStartTime(virtualStartTime);
    setEndTime(addSecondsToDate(virtualStartTime, totalDuration));
    setIsTimerRunning(true);
  }, [totalDuration]);

  // Timer tick effect - should be called from component
  const tick = useCallback(() => {
    setElapsedTime(prev => prev + 1);
    setRemainingTime(prev => Math.max(0, prev - 1));
  }, []);

  return {
    isTimerRunning,
    elapsedTime,
    remainingTime,
    startTime,
    endTime,
    timerRef,
    startTimer,
    pauseTimer,
    toggleTimer,
    resetTimer,
    startFromTime,
    tick,
    setElapsedTime,
    setRemainingTime,
    setIsTimerRunning,
  };
}
