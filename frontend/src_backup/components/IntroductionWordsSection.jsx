import { useState, useEffect, useRef } from "react";
import { Play, Timer, Mic, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IntroductionWordsSection({
  isActive,
  isTimerRunning,
  estimatedTime = 60, // 1 minute default
  onStartIntroduction,
  onGoToFirstParagraph,
  overtimeAlertEnabled,
  soundEnabled,
  vibrationEnabled,
  playNotificationSound,
  triggerVibration,
  hasStarted, // true if timer has been started
  darkMode = false
}) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeAlertTriggered, setOvertimeAlertTriggered] = useState(false);
  const timerRef = useRef(null);
  const cardRef = useRef(null);

  const isOverTime = elapsedTime > estimatedTime;

  // Auto-scroll when active
  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);

  // Overtime alert
  useEffect(() => {
    if (isOverTime && !overtimeAlertTriggered && overtimeAlertEnabled && isActive) {
      setOvertimeAlertTriggered(true);
      if (soundEnabled && playNotificationSound) {
        playNotificationSound('urgent');
      }
      if (vibrationEnabled && triggerVibration) {
        triggerVibration([200, 100, 200, 100, 200]);
      }
    }
  }, [isOverTime, overtimeAlertTriggered, overtimeAlertEnabled, isActive, soundEnabled, vibrationEnabled, playNotificationSound, triggerVibration]);

  // Timer
  useEffect(() => {
    if (isActive && isTimerRunning) {
      setElapsedTime(0);
      setOvertimeAlertTriggered(false);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isTimerRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Not yet started state - show start button
  if (!hasStarted) {
    return (
      <div 
        ref={cardRef}
        className={`relative rounded-2xl border-2 p-5 shadow-md ${
          darkMode 
            ? 'border-blue-700 bg-gradient-to-br from-blue-950 to-zinc-900'
            : 'border-blue-300 bg-gradient-to-br from-blue-50 to-white'
        }`}
        data-testid="introduction-words-section"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Mic className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>Palabras de Introducción</h3>
            <p className={`text-sm mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              El conductor introduce el tema del artículo de estudio.
            </p>
            <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full ${
              darkMode ? 'bg-blue-900' : 'bg-blue-100'
            }`}>
              <Timer className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Tiempo estimado: {formatTime(estimatedTime)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <Button
            onClick={onStartIntroduction}
            className="rounded-full px-8 py-3 text-base font-bold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
            data-testid="start-introduction-btn"
          >
            <Play className="w-5 h-5 mr-2" />
            Iniciar Estudio
          </Button>
        </div>
      </div>
    );
  }

  // Completed state
  if (!isActive && hasStarted) {
    return (
      <div 
        className={`relative rounded-2xl border-2 p-5 opacity-70 ${
          darkMode 
            ? 'border-zinc-700 bg-zinc-800/50'
            : 'border-slate-200 bg-slate-50/50'
        }`}
        data-testid="introduction-words-completed"
      >
        {/* Completed Banner */}
        <div className="absolute top-0 left-0 right-0 bg-slate-500 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 rounded-t-xl">
          <Check className="w-3.5 h-3.5" />
          COMPLETADO
        </div>
        
        <div className="mt-6 flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-zinc-700' : 'bg-slate-300'
          }`}>
            <Mic className={`w-6 h-6 ${darkMode ? 'text-zinc-400' : 'text-slate-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${darkMode ? 'text-zinc-400' : 'text-slate-600'}`}>Palabras de Introducción</h3>
            <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-500' : 'text-slate-500'}`}>Introducción completada</p>
          </div>
        </div>
      </div>
    );
  }

  // Active state - currently in introduction
  return (
    <div 
      ref={cardRef}
      className={`relative rounded-2xl border-2 shadow-lg transition-all duration-300 ${
        isOverTime 
          ? darkMode 
            ? 'border-red-600 bg-red-950/50 shadow-red-900/30' 
            : 'border-red-400 bg-red-50 shadow-red-100' 
          : darkMode 
            ? 'border-blue-600 bg-blue-950/50 shadow-blue-900/30' 
            : 'border-blue-400 bg-blue-50 shadow-blue-100'
      }`}
      data-testid="introduction-words-active"
    >
      {/* Active Banner with Timer */}
      <div className={`absolute top-0 left-0 right-0 text-white text-xs font-bold rounded-t-xl ${
        isOverTime 
          ? 'bg-gradient-to-r from-red-500 to-red-600' 
          : 'bg-gradient-to-r from-blue-500 to-blue-600'
      }`}>
        {/* Main row */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
            </span>
            <Mic className="w-4 h-4" />
            <span className="font-bold tracking-wide">
              {isOverTime ? 'TIEMPO EXCEDIDO' : 'PALABRAS DE INTRODUCCIÓN'}
            </span>
          </div>
          
          {/* Timer display - elegant style */}
          {isTimerRunning && (
            <div className={`flex items-baseline gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm ${
              isOverTime ? 'bg-red-500/40' : 'bg-black/20'
            }`}>
              <span className="font-light text-lg tracking-wide tabular-nums">
                {formatTime(elapsedTime)}
              </span>
              <span className="text-sm opacity-50 mx-0.5">/</span>
              <span className="font-light text-lg tracking-wide tabular-nums opacity-70">
                {formatTime(estimatedTime)}
              </span>
            </div>
          )}
        </div>
        
        {/* Overtime badge */}
        {isOverTime && (
          <div className="px-4 pb-2 -mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-700 text-white text-[10px] font-bold rounded-full animate-pulse">
              ⚠️ +{formatTime(elapsedTime - estimatedTime)} excedido
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`p-5 ${isOverTime ? 'pt-20' : 'pt-16'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
            isOverTime 
              ? 'bg-gradient-to-br from-red-500 to-red-600' 
              : 'bg-gradient-to-br from-blue-500 to-blue-600'
          }`}>
            <Mic className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${
              isOverTime 
                ? darkMode ? 'text-red-300' : 'text-red-800' 
                : darkMode ? 'text-blue-300' : 'text-blue-800'
            }`}>
              Palabras de Introducción
            </h3>
            <p className={`text-sm mt-1 ${
              isOverTime 
                ? darkMode ? 'text-red-400' : 'text-red-600' 
                : darkMode ? 'text-blue-400' : 'text-blue-600'
            }`}>
              El conductor introduce el tema del artículo de estudio.
            </p>
          </div>
        </div>

        {/* Button to go to first paragraph */}
        <div className="mt-5 flex justify-end">
          <Button
            onClick={onGoToFirstParagraph}
            className={`rounded-full px-6 py-2 text-sm font-semibold shadow-lg transition-all ${
              isOverTime 
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700' 
                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
            } text-white`}
            data-testid="go-to-first-paragraph-btn"
          >
            Pasar al Primer Párrafo
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
