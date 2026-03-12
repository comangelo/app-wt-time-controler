import { Play, Pause, RotateCcw, Clock, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatTime, formatClockTime } from "../utils/timeFormatters";
import { useMemo, useState, useEffect } from "react";

export function TimerDisplay({
  elapsedTime,
  isTimerRunning,
  startTime,
  endTime,
  progressPercentage,
  onToggle,
  onReset,
  remainingTime,
  totalDuration = 60,
  manualEndTime,
  onManualEndTimeChange,
}) {
  const isLowTime = remainingTime <= 300;
  const isOvertime = remainingTime <= 0;
  const [isEditingEndTime, setIsEditingEndTime] = useState(false);
  const [editHours, setEditHours] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  
  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate projected times based on current time and configured duration
  const { displayEndTime, calculatedDuration } = useMemo(() => {
    if (startTime && endTime) {
      const diffMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      return { displayEndTime: endTime, calculatedDuration: diffMinutes };
    }
    const now = new Date();
    // Use manual end time if set, otherwise calculate from duration
    if (manualEndTime) {
      const diffMinutes = Math.round((manualEndTime.getTime() - now.getTime()) / 60000);
      return { displayEndTime: manualEndTime, calculatedDuration: diffMinutes };
    }
    const projected = new Date(now.getTime() + totalDuration * 60 * 1000);
    return { displayEndTime: projected, calculatedDuration: totalDuration };
  }, [startTime, endTime, totalDuration, manualEndTime]);

  // Display duration - use calculated duration when we have start and end times, or manual end time
  const displayDuration = (startTime && endTime) || manualEndTime ? calculatedDuration : totalDuration;

  const startEditingEndTime = () => {
    const timeToEdit = manualEndTime || displayEndTime;
    setEditHours(timeToEdit.getHours().toString().padStart(2, '0'));
    setEditMinutes(timeToEdit.getMinutes().toString().padStart(2, '0'));
    setIsEditingEndTime(true);
  };

  const saveEndTime = () => {
    const hours = parseInt(editHours) || 0;
    const minutes = parseInt(editMinutes) || 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const newEndTime = new Date();
      newEndTime.setHours(hours, minutes, 0, 0);
      onManualEndTimeChange(newEndTime);
      setIsEditingEndTime(false);
    }
  };

  const cancelEditEndTime = () => {
    setIsEditingEndTime(false);
  };

  const clearManualEndTime = () => {
    onManualEndTimeChange(null);
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Start/End Time Display - Always Visible, Responsive */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xl border border-zinc-600" data-testid="time-schedule-card">
        
        {/* Current Time Clock - Always visible */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center gap-2 bg-zinc-700/50 rounded-full px-4 py-1.5 border border-zinc-600">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Hora actual</span>
            <span 
              className="text-lg font-bold text-white"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
              data-testid="current-time-display"
            >
              {formatClockTime(currentTime)}
            </span>
          </div>
        </div>
        
        {/* Grid layout for times */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 items-center">
          
          {/* Start Time - Green (empty until started) */}
          <div className="text-center">
            <div className="inline-block bg-emerald-900/50 rounded-lg px-2 py-0.5 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Inicio</span>
            </div>
            <p 
              className={`text-base sm:text-xl md:text-2xl font-black ${startTime ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-zinc-500'}`}
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
              data-testid="start-time-display"
            >
              {startTime ? formatClockTime(startTime) : '--:--'}
            </p>
          </div>
          
          {/* Duration - Orange */}
          <div className="text-center">
            <div className="inline-block bg-orange-900/50 rounded-lg px-2 py-0.5 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-orange-400 uppercase tracking-wider">Duración</span>
            </div>
            <p className={`text-base sm:text-xl md:text-2xl font-black ${manualEndTime && !startTime ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]'}`}>
              {displayDuration}<span className="text-xs sm:text-sm ml-0.5">min</span>
            </p>
          </div>
          
          {/* End Time - Yellow - Editable */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1 bg-yellow-900/50 rounded-lg px-2 py-0.5 mb-1">
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${isOvertime ? 'text-rose-400' : isLowTime ? 'text-rose-400' : 'text-yellow-400'}`}>
                Fin
              </span>
              {!startTime && !isEditingEndTime && (
                <button
                  onClick={startEditingEndTime}
                  className="p-0.5 rounded hover:bg-yellow-500/20 transition-colors"
                  title="Editar hora de fin"
                  data-testid="edit-end-time-btn"
                >
                  <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-300" />
                </button>
              )}
            </div>
            
            {isEditingEndTime ? (
              <div className="flex flex-col items-center gap-2">
                {/* Time inputs */}
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="text"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="w-10 sm:w-12 h-8 sm:h-10 text-center bg-zinc-700 border-2 border-yellow-500/50 rounded-lg text-yellow-300 text-base sm:text-xl font-black focus:border-yellow-400 focus:outline-none"
                    placeholder="HH"
                    maxLength={2}
                    autoFocus
                    data-testid="edit-hours-input"
                  />
                  <span className="text-yellow-400 text-lg sm:text-xl font-black animate-pulse">:</span>
                  <input
                    type="text"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="w-10 sm:w-12 h-8 sm:h-10 text-center bg-zinc-700 border-2 border-yellow-500/50 rounded-lg text-yellow-300 text-base sm:text-xl font-black focus:border-yellow-400 focus:outline-none"
                    placeholder="MM"
                    maxLength={2}
                    data-testid="edit-minutes-input"
                  />
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveEndTime}
                    className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg"
                    title="Guardar"
                    data-testid="save-end-time-btn"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={cancelEditEndTime}
                    className="p-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 transition-all"
                    title="Cancelar"
                    data-testid="cancel-end-time-btn"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            ) : (
              <p 
                className={`text-base sm:text-xl md:text-2xl font-black cursor-pointer transition-colors ${
                  !startTime ? 'text-yellow-400/60 hover:text-yellow-400' :
                  isOvertime ? 'text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]' : 
                  isLowTime ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]' : 
                  'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                }`}
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
                onClick={!startTime ? startEditingEndTime : undefined}
                title={!startTime ? "Clic para editar" : undefined}
                data-testid="end-time-display"
              >
                {formatClockTime(displayEndTime)}
              </p>
            )}
          </div>
        </div>
        
        {/* Footer info */}
        {!startTime && (
          <div className="text-center mt-2 pt-2 border-t border-zinc-600">
            {manualEndTime ? (
              <button
                onClick={clearManualEndTime}
                className="text-[10px] sm:text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                data-testid="clear-manual-time-btn"
              >
                ↺ Restaurar hora automática
              </button>
            ) : (
              <p className="text-zinc-400 text-[10px] sm:text-xs">
                Hora actual + <span className="text-orange-400 font-bold">{totalDuration} min</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main Timer Card */}
      <Card className="border-4 border-orange-500 shadow-lg rounded-xl sm:rounded-2xl overflow-hidden" data-testid="main-timer-card">
        <CardHeader className="bg-orange-100 pb-3 sm:pb-4 pt-3 sm:pt-5">
          <CardTitle className="text-2xl sm:text-3xl text-orange-500 text-center font-black tracking-wider uppercase font-heading">
            Cronómetro General
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 text-center bg-white">
          {/* Main Timer */}
          <div className="py-2 sm:py-4">
            <p 
              className="text-6xl sm:text-7xl md:text-8xl font-normal text-slate-800 tracking-tighter" 
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              data-testid="elapsed-time"
            >
              {formatTime(elapsedTime)}
            </p>
            <p className="text-slate-500 mt-1 sm:mt-3 text-sm font-medium uppercase tracking-wider">Tiempo Transcurrido</p>
          </div>

          {/* Remaining Time */}
          <div className="pb-2 sm:pb-4">
            <p
              className={`text-6xl sm:text-7xl md:text-8xl font-normal tracking-tighter ${isOvertime ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              data-testid="remaining-time"
            >
              {isOvertime ? `-${formatTime(Math.abs(remainingTime))}` : formatTime(remainingTime)}
            </p>
            <p className="text-slate-500 mt-1 text-sm font-medium uppercase tracking-wider">Restante de {displayDuration} min</p>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 sm:mt-6 mb-4 sm:mb-8 px-4 sm:px-0">
            <Progress value={progressPercentage} className="h-3 sm:h-4 rounded-full bg-orange-100 [&>div]:bg-orange-500" />
            <p className="text-sm sm:text-base text-slate-500 mt-2 font-bold">{Math.round(progressPercentage)}%</p>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <Button 
              onClick={onToggle}
              className={`rounded-full shadow-lg transition-all active:scale-95 ${
                isTimerRunning 
                  ? 'bg-slate-700 hover:bg-slate-800' 
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
              style={{ width: '56px', height: '56px' }}
              data-testid="timer-toggle-btn"
            >
              {isTimerRunning ? (
                <Pause className="w-5 h-5 sm:w-7 sm:h-7" />
              ) : (
                <Play className="w-5 h-5 sm:w-7 sm:h-7 ml-0.5" />
              )}
            </Button>
            <Button 
              variant="outline"
              onClick={onReset}
              className="rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              style={{ width: '44px', height: '44px' }}
              data-testid="timer-reset-btn"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
