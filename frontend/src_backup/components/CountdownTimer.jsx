import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "../utils/timeFormatters";

export function CountdownTimer({ remainingTime, adjustedTimes, isTimerRunning }) {
  const timePerQuestion = isTimerRunning && adjustedTimes?.perQuestion 
    ? adjustedTimes.perQuestion 
    : 35;
  const isAdjusted = isTimerRunning && timePerQuestion !== 35;
  const timeDiff = timePerQuestion - 35;
  const isLowTime = isTimerRunning && timePerQuestion < 20;
  const isCritical = isTimerRunning && timePerQuestion < 15;

  return (
    <Card className={`border shadow-sm rounded-2xl overflow-hidden transition-all ${
      isCritical ? 'border-red-300 bg-red-50' :
      isLowTime ? 'border-orange-300 bg-orange-50' :
      'border-orange-200'
    }`} data-testid="countdown-timer-card">
      <CardHeader className={`pb-3 pt-4 ${
        isCritical ? 'bg-red-500' :
        isLowTime ? 'bg-orange-500' :
        'bg-orange-500'
      }`}>
        <CardTitle className="text-sm text-white text-center font-medium flex items-center justify-center gap-2">
          {isLowTime && <AlertTriangle className="w-4 h-4" />}
          Tiempo Restante
          {isLowTime && <AlertTriangle className="w-4 h-4" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 text-center bg-white">
        {/* Low Time Alert */}
        {isLowTime && (
          <div className={`mb-4 p-2 rounded-lg ${isCritical ? 'bg-red-100' : 'bg-orange-100'}`}>
            <span className={`text-sm font-medium ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
              {isCritical ? '¡Tiempo crítico!' : '¡Acelera!'}
            </span>
          </div>
        )}
        
        {/* Main Countdown */}
        <p 
          className={`text-5xl lg:text-6xl font-light tracking-tight ${
            isCritical ? 'text-red-600' :
            isLowTime ? 'text-orange-600' :
            'text-orange-500'
          }`} 
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          data-testid="remaining-time"
        >
          {formatTime(remainingTime)}
        </p>
        <p className="text-slate-400 mt-3 text-sm">de 60 minutos</p>
        
        {/* Adjusted Time Info */}
        {isAdjusted && (
          <div className={`mt-5 p-3 rounded-xl ${
            isCritical ? 'bg-red-50' :
            isLowTime ? 'bg-orange-50' :
            timeDiff > 0 ? 'bg-green-50' : 'bg-orange-50'
          }`}>
            <p className="text-xs text-slate-500 mb-1">Por pregunta</p>
            <p 
              className={`text-2xl font-light ${
                isCritical ? 'text-red-600' :
                isLowTime ? 'text-orange-600' :
                timeDiff > 0 ? 'text-green-600' : 'text-orange-600'
              }`}
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {Math.round(timePerQuestion)}s
            </p>
            <p className={`text-xs mt-1 ${timeDiff > 0 ? 'text-green-600' : 'text-orange-600'}`}>
              {timeDiff > 0 ? '+' : ''}{Math.round(timeDiff)}s
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
