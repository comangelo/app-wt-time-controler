import { useState, useEffect, useRef } from "react";
import { Clock, Timer, MessageCircleQuestion, AlertCircle, ArrowRight, Check, Sparkles, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatClockTime, addSecondsToDate, formatTimeCompact } from "../utils/timeFormatters";

// Closing Words Section Component
function ClosingWordsSection({
  isActive,
  isTimerRunning,
  estimatedTime = 60, // 1 minute default
  onFinishStudy,
  overtimeAlertEnabled,
  soundEnabled,
  vibrationEnabled,
  playNotificationSound,
  triggerVibration,
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

  // Timer for closing words
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

  if (!isActive) {
    // Show preview/pending state
    return (
      <div className={`relative rounded-2xl border-2 p-4 opacity-60 ${
        darkMode 
          ? 'bg-purple-950/50 border-purple-800' 
          : 'bg-purple-50 border-purple-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            darkMode ? 'bg-purple-800' : 'bg-purple-200'
          }`}>
            <Sparkles className={`w-6 h-6 ${darkMode ? 'text-purple-300' : 'text-purple-600'}`} />
          </div>
          <div>
            <p className={`font-bold ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>Palabras de Conclusión</p>
            <p className={`text-sm ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>Después de las preguntas de repaso</p>
            <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              darkMode ? 'bg-purple-900' : 'bg-purple-100'
            }`}>
              <Timer className={`w-3 h-3 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-xs font-medium ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>{formatTime(estimatedTime)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active state
  return (
    <div 
      ref={cardRef}
      className={`relative rounded-2xl border-2 shadow-lg transition-all duration-300 ${
        isOverTime 
          ? darkMode 
            ? 'border-red-600 bg-red-950/50 shadow-red-900/30' 
            : 'border-red-400 bg-red-50 shadow-red-100' 
          : darkMode 
            ? 'border-purple-600 bg-purple-950/50 shadow-purple-900/30' 
            : 'border-purple-400 bg-purple-50 shadow-purple-100'
      }`}
      data-testid="closing-words-section"
    >
      {/* Active Banner with Timer */}
      <div className={`absolute top-0 left-0 right-0 text-white text-xs font-bold rounded-t-2xl ${
        isOverTime 
          ? 'bg-gradient-to-r from-red-500 to-red-600' 
          : 'bg-gradient-to-r from-purple-500 to-purple-600'
      }`}>
        {/* Main row */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
            </span>
            <Sparkles className="w-4 h-4" />
            <span className="font-bold tracking-wide">
              {isOverTime ? 'TIEMPO EXCEDIDO' : 'PALABRAS DE CONCLUSIÓN'}
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
              : 'bg-gradient-to-br from-purple-500 to-purple-600'
          }`}>
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${
              isOverTime 
                ? darkMode ? 'text-red-300' : 'text-red-800' 
                : darkMode ? 'text-purple-300' : 'text-purple-800'
            }`}>
              Palabras de Conclusión
            </h3>
            <p className={`text-sm mt-1 ${
              isOverTime 
                ? darkMode ? 'text-red-400' : 'text-red-600' 
                : darkMode ? 'text-purple-400' : 'text-purple-600'
            }`}>
              Resume los puntos principales y anima a la congregación.
            </p>
          </div>
        </div>

        {/* Finish Button */}
        <div className="mt-5 flex justify-end">
          <Button
            onClick={onFinishStudy}
            className="rounded-full px-6 py-2 text-sm font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg transition-all"
            data-testid="finish-study-btn"
          >
            <PartyPopper className="w-4 h-4 mr-2" />
            Finalizar Estudio
            <Check className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewQuestionCard({
  question,
  index,
  isCurrentQuestion,
  isCompletedQuestion,
  perQuestionTime,
  isLowTime,
  isCriticalTime,
  isAdjusted,
  timeDiff,
  onGoToNext,
  isLastQuestion,
  overtimeAlertEnabled,
  soundEnabled,
  vibrationEnabled,
  playNotificationSound,
  triggerVibration,
  isTimerRunning,
  darkMode = false
}) {
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const [overtimeAlertTriggered, setOvertimeAlertTriggered] = useState(false);
  const questionTimerRef = useRef(null);
  const cardRef = useRef(null);

  const estimatedTime = perQuestionTime;
  const isOverTime = questionElapsed > estimatedTime;

  // Auto-scroll to current question
  useEffect(() => {
    if (isCurrentQuestion && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCurrentQuestion]);

  // Overtime alert
  useEffect(() => {
    if (isOverTime && !overtimeAlertTriggered && overtimeAlertEnabled && isCurrentQuestion) {
      setOvertimeAlertTriggered(true);
      if (soundEnabled && playNotificationSound) {
        playNotificationSound('urgent');
      }
      if (vibrationEnabled && triggerVibration) {
        triggerVibration([200, 100, 200, 100, 200]);
      }
    }
  }, [isOverTime, overtimeAlertTriggered, overtimeAlertEnabled, isCurrentQuestion, soundEnabled, vibrationEnabled, playNotificationSound, triggerVibration]);

  // Reset overtime alert when question changes
  useEffect(() => {
    if (!isCurrentQuestion) {
      setOvertimeAlertTriggered(false);
    }
  }, [isCurrentQuestion]);

  // Question timer
  useEffect(() => {
    if (isCurrentQuestion && isTimerRunning) {
      setQuestionElapsed(0);
      setOvertimeAlertTriggered(false);
      
      questionTimerRef.current = setInterval(() => {
        setQuestionElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
      if (!isCurrentQuestion) {
        setQuestionElapsed(0);
      }
    }

    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
    };
  }, [isCurrentQuestion, isTimerRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={cardRef}
      className={`relative rounded-xl transition-all duration-300 ${
        isCompletedQuestion
          ? darkMode 
            ? 'bg-zinc-800 border border-zinc-700 opacity-70'
            : 'bg-slate-100 border border-slate-200 opacity-70'
          : isCurrentQuestion 
            ? isOverTime
              ? 'bg-red-100 border-2 border-red-400 shadow-lg'
              : 'bg-green-100 border-2 border-green-400 shadow-lg'
            : isCriticalTime 
              ? darkMode 
                ? 'bg-red-950/50 border border-red-800'
                : 'bg-red-100 border border-red-200'
              : isLowTime 
                ? darkMode 
                  ? 'bg-orange-950/50 border border-orange-800'
                  : 'bg-orange-100 border border-orange-200'
                : darkMode 
                  ? 'bg-red-950/30 border border-red-900'
                  : 'bg-red-50 border border-red-100'
      }`}
      data-testid={`review-question-${index}`}
    >
      {/* Current Question Indicator with Timer */}
      {isCurrentQuestion && (
        <div className={`absolute top-0 left-0 right-0 text-white text-xs font-bold rounded-t-xl ${
          isOverTime 
            ? 'bg-gradient-to-r from-red-500 to-red-600' 
            : 'bg-gradient-to-r from-green-500 to-green-600'
        }`}>
          {/* Main row - always visible */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
              </span>
              <span className="text-[11px] sm:text-xs font-bold tracking-wide">
                {isOverTime ? 'TIEMPO EXCEDIDO' : 'RESPONDIENDO'}
              </span>
            </div>
            
            {/* Timer display - elegant style */}
            {isTimerRunning && (
              <div className={`flex items-baseline gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm ${
                isOverTime ? 'bg-red-500/40' : 'bg-black/20'
              }`}>
                <span className="font-light text-lg tracking-wide tabular-nums">
                  {formatTime(questionElapsed)}
                </span>
                <span className="text-sm opacity-50 mx-0.5">/</span>
                <span className="font-light text-lg tracking-wide tabular-nums opacity-70">
                  {formatTime(Math.round(estimatedTime))}
                </span>
              </div>
            )}
          </div>
          
          {/* Overtime badge - separate row when overtime */}
          {isOverTime && (
            <div className="px-3 pb-2 -mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-700 text-white text-[10px] font-bold rounded-full animate-pulse">
                ⚠️ +{formatTime(questionElapsed - Math.round(estimatedTime))} excedido
              </span>
            </div>
          )}
        </div>
      )}

      {/* Completed Indicator */}
      {isCompletedQuestion && (
        <div className={`absolute top-0 left-0 right-0 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 rounded-t-xl ${
          darkMode ? 'bg-zinc-600' : 'bg-slate-400'
        }`}>
          <Check className="w-3 h-3" />
          COMPLETADA
        </div>
      )}

      <div className={`p-4 ${isCurrentQuestion ? (isOverTime ? 'pt-20' : 'pt-16') : isCompletedQuestion ? 'pt-10' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
            isCompletedQuestion
              ? darkMode ? 'bg-zinc-700 text-zinc-400' : 'bg-slate-300 text-slate-600'
              : isCurrentQuestion
                ? isOverTime ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                : darkMode ? 'bg-red-900 text-red-300' : 'bg-red-200 text-red-700'
          }`}>
            {index + 1}
          </div>
          
          <div className="flex-1">
            <p className={`text-sm ${
              isCompletedQuestion 
                ? darkMode ? 'text-zinc-500' : 'text-slate-500' 
                : darkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              {question.text}
            </p>
            
            {/* Time Badge */}
            {!isCompletedQuestion && !isCurrentQuestion && (
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isCriticalTime 
                    ? darkMode ? 'bg-red-900 text-red-300' : 'bg-red-200 text-red-700' 
                    : isLowTime 
                      ? darkMode ? 'bg-orange-900 text-orange-300' : 'bg-orange-200 text-orange-700' 
                      : darkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'
                }`}>
                  {Math.round(perQuestionTime)} seg
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Next Button */}
        {isCurrentQuestion && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={onGoToNext}
              className={`rounded-full px-6 py-2 text-sm font-semibold ${
                isLastQuestion
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              data-testid={`next-review-question-${index}`}
            >
              {isLastQuestion ? (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Palabras de Conclusión
                </>
              ) : (
                <>
                  Siguiente Pregunta
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FinalQuestionsSection({ 
  finalQuestions, 
  finalQuestionsTitle,
  startTime, 
  isTimerRunning, 
  adjustedTimes, 
  getQuestionTime, 
  originalStartTime,
  isInReviewMode,
  currentReviewQuestion,
  onStartReview,
  onNextReviewQuestion,
  onStartClosingWords,
  isInClosingWordsMode,
  closingWordsDuration = 60,
  onFinishStudy,
  overtimeAlertEnabled,
  soundEnabled,
  vibrationEnabled,
  playNotificationSound,
  triggerVibration,
  darkMode = false
}) {
  if (!finalQuestions || finalQuestions.length === 0) return null;
  
  const totalTime = isTimerRunning && adjustedTimes.totalTime 
    ? adjustedTimes.totalTime 
    : finalQuestions.length * 35;
  
  const perQuestionTime = isTimerRunning && adjustedTimes.perQuestion
    ? adjustedTimes.perQuestion
    : 35;
  
  const isAdjusted = isTimerRunning && perQuestionTime !== 35;
  const timeDiff = perQuestionTime - 35;
  const isLowTime = isTimerRunning && perQuestionTime < 20;
  const isCriticalTime = isTimerRunning && perQuestionTime < 10;

  const remainingQuestions = finalQuestions.length - (currentReviewQuestion || 0);

  return (
    <Card className={`shadow-sm rounded-2xl ${
      isCriticalTime 
        ? 'border-red-500 bg-red-50' 
        : isLowTime 
          ? 'border-orange-400 bg-orange-50' 
          : isInReviewMode 
            ? darkMode 
              ? 'border-green-700 bg-green-950/30' 
              : 'border-green-400 bg-green-50/30'
            : darkMode 
              ? 'border-red-800 bg-red-950/30' 
              : 'border-red-200 bg-red-50/30'
    }`} data-testid="final-questions-section">
      {/* Low Time Alert Banner */}
      {isLowTime && !isInReviewMode && (
        <div className={`${isCriticalTime ? 'bg-red-500' : 'bg-orange-500'} text-white px-4 py-2 flex items-center justify-center gap-2 rounded-t-2xl`}>
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isCriticalTime ? '¡Tiempo crítico!' : '¡Acelera!'}
          </span>
        </div>
      )}

      {/* Review Mode Active Banner */}
      {isInReviewMode && (
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="w-5 h-5" />
            <span className="font-bold">PREGUNTAS DE REPASO</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              Pregunta {(currentReviewQuestion || 0) + 1} de {finalQuestions.length}
            </span>
            <Badge className="bg-white/20 text-white">
              {remainingQuestions} restantes
            </Badge>
          </div>
        </div>
      )}
      
      <CardHeader className={`pb-3 ${isInReviewMode ? 'pt-4' : ''}`}>
        {!isInReviewMode && (
          <>
            <CardTitle className={`text-base flex items-center gap-2 ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
              <AlertCircle className="w-4 h-4" />
              Preguntas de Repaso
              <Badge variant="destructive" className="ml-2 text-xs">{finalQuestions.length}</Badge>
            </CardTitle>
            <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
              Preguntas de repaso al final del artículo{finalQuestionsTitle ? `: ${finalQuestionsTitle}` : ''}
            </p>
          </>
        )}
        
        {/* Time indicators */}
        {startTime && !isInReviewMode && (
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="text-center">
              <span className={`text-xs block mb-1 ${darkMode ? 'text-red-500' : 'text-red-400'}`}>Inicio</span>
              <span className={`text-lg font-light ${darkMode ? 'text-red-400' : 'text-red-700'}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {isTimerRunning && adjustedTimes.start 
                  ? formatClockTime(adjustedTimes.start)
                  : formatClockTime(addSecondsToDate(startTime, originalStartTime))
                }
              </span>
            </div>
            <div className={darkMode ? 'text-red-600' : 'text-red-300'}>—</div>
            <div className="text-center">
              <span className={`text-xs block mb-1 ${darkMode ? 'text-red-500' : 'text-red-400'}`}>Fin</span>
              <span className={`text-lg font-light ${darkMode ? 'text-red-400' : 'text-red-700'}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {isTimerRunning && adjustedTimes.end
                  ? formatClockTime(adjustedTimes.end)
                  : formatClockTime(addSecondsToDate(startTime, originalStartTime + (finalQuestions.length * 35)))
                }
              </span>
            </div>
            <div className={darkMode ? 'text-red-600' : 'text-red-300'}>|</div>
            <div className={`text-center px-3 py-2 rounded-lg ${
              isCriticalTime 
                ? darkMode ? 'bg-red-900' : 'bg-red-200' 
                : isLowTime 
                  ? darkMode ? 'bg-orange-900' : 'bg-orange-200' 
                  : isAdjusted 
                    ? (timeDiff > 0 
                        ? darkMode ? 'bg-green-900' : 'bg-green-100' 
                        : darkMode ? 'bg-orange-900' : 'bg-orange-100') 
                    : darkMode ? 'bg-red-900' : 'bg-red-100'
            }`}>
              <span className={`text-xs block mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Por pregunta</span>
              <span 
                className={`text-xl font-light ${
                  isCriticalTime 
                    ? darkMode ? 'text-red-400' : 'text-red-700' 
                    : isLowTime 
                      ? darkMode ? 'text-orange-400' : 'text-orange-700' 
                      : isAdjusted 
                        ? (timeDiff > 0 
                            ? darkMode ? 'text-green-400' : 'text-green-700' 
                            : darkMode ? 'text-orange-400' : 'text-orange-700') 
                        : darkMode ? 'text-red-400' : 'text-red-700'
                }`}
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                {Math.round(perQuestionTime)}s
              </span>
              {isAdjusted && (
                <span className={`text-xs block ${
                  timeDiff > 0 
                    ? darkMode ? 'text-green-400' : 'text-green-600' 
                    : darkMode ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  {timeDiff > 0 ? '+' : ''}{Math.round(timeDiff)}s
                </span>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {isInReviewMode ? (
          // Review mode - show questions with navigation
          finalQuestions.map((q, idx) => (
            <ReviewQuestionCard
              key={idx}
              question={q}
              index={idx}
              isCurrentQuestion={idx === currentReviewQuestion && !isInClosingWordsMode}
              isCompletedQuestion={idx < currentReviewQuestion || isInClosingWordsMode}
              perQuestionTime={perQuestionTime}
              isLowTime={isLowTime}
              isCriticalTime={isCriticalTime}
              isAdjusted={isAdjusted}
              timeDiff={timeDiff}
              onGoToNext={() => {
                if (idx === finalQuestions.length - 1) {
                  onStartClosingWords?.();
                } else {
                  onNextReviewQuestion?.();
                }
              }}
              isLastQuestion={idx === finalQuestions.length - 1}
              overtimeAlertEnabled={overtimeAlertEnabled}
              soundEnabled={soundEnabled}
              vibrationEnabled={vibrationEnabled}
              playNotificationSound={playNotificationSound}
              triggerVibration={triggerVibration}
              isTimerRunning={isTimerRunning}
              darkMode={darkMode}
            />
          ))
        ) : (
          // Normal mode - show simple list
          finalQuestions.map((q, idx) => (
            <div 
              key={idx}
              className={`rounded-xl py-3 px-4 text-sm ${
                isCriticalTime 
                  ? darkMode ? 'bg-red-950/50 text-red-300' : 'bg-red-100 text-red-900' 
                  : isLowTime 
                    ? darkMode ? 'bg-orange-950/50 text-orange-300' : 'bg-orange-100 text-orange-900' 
                    : darkMode ? 'bg-red-950/30 text-red-300' : 'bg-red-100/50 text-red-800'
              }`}
              data-testid={`final-question-${idx}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 flex items-start gap-2">
                  <MessageCircleQuestion className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    isCriticalTime 
                      ? darkMode ? 'text-red-400' : 'text-red-600' 
                      : isLowTime 
                        ? darkMode ? 'text-orange-400' : 'text-orange-600' 
                        : darkMode ? 'text-red-400' : 'text-red-500'
                  }`} />
                  <span>{q.text}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-light px-2 py-0.5 rounded-full ${
                    isCriticalTime 
                      ? darkMode ? 'bg-red-900 text-red-300' : 'bg-red-200 text-red-700' 
                      : isLowTime 
                        ? darkMode ? 'bg-orange-900 text-orange-300' : 'bg-orange-200 text-orange-700' 
                        : isAdjusted 
                          ? (timeDiff > 0 
                              ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700' 
                              : darkMode ? 'bg-orange-900 text-orange-300' : 'bg-orange-100 text-orange-700') 
                          : darkMode ? 'bg-red-900 text-red-400' : 'bg-red-200 text-red-600'
                  }`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    +{formatTimeCompact(perQuestionTime)}
                  </span>
                  {startTime && (
                    <span className={`text-xs ${darkMode ? 'text-red-400' : 'text-red-500'}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {isTimerRunning && getQuestionTime
                        ? formatClockTime(getQuestionTime(idx))
                        : formatClockTime(addSecondsToDate(startTime, originalStartTime + (idx * 35)))
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Closing Words Section - Always visible */}
        <ClosingWordsSection 
          isActive={isInClosingWordsMode}
          isTimerRunning={isTimerRunning}
          estimatedTime={closingWordsDuration}
          onFinishStudy={onFinishStudy}
          overtimeAlertEnabled={overtimeAlertEnabled}
          soundEnabled={soundEnabled}
          vibrationEnabled={vibrationEnabled}
          playNotificationSound={playNotificationSound}
          triggerVibration={triggerVibration}
          darkMode={darkMode}
        />
      </CardContent>
    </Card>
  );
}
