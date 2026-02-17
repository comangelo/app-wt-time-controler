import { useState, useEffect, useRef } from "react";
import { Play, Clock, ArrowRight, ChevronDown, ChevronUp, MessageCircleQuestion, Check, Timer, Eye, EyeOff, Image, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { formatTimeText, formatClockTime, formatTimeCompact } from "../utils/timeFormatters";

export function ParagraphCard({ 
  paragraph, 
  groupedParagraphs = [], // Array of paragraphs that are grouped together
  index, 
  startTime, 
  paragraphTimes, 
  onStartFromHere, 
  isTimerRunning, 
  isCurrentParagraph, 
  isCompletedParagraph, 
  elapsedTime, 
  onGoToNext, 
  isLastParagraph,
  adjustedQuestionTime,
  scaleFactor = 1, // Scale factor for proportional time adjustment
  overtimeAlertEnabled,
  soundEnabled,
  vibrationEnabled,
  playNotificationSound,
  triggerVibration,
  onStartReview,
  hasReviewQuestions,
  darkMode = false,
  showContentGlobal = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showContent, setShowContent] = useState(true); // Individual content visibility
  const [paragraphElapsed, setParagraphElapsed] = useState(0);
  const [overtimeAlertTriggered, setOvertimeAlertTriggered] = useState(false);
  const cardRef = useRef(null);
  const paragraphTimerRef = useRef(null);
  
  // Sync with global show/hide state
  useEffect(() => {
    setShowContent(showContentGlobal);
  }, [showContentGlobal]);
  
  // If grouped, use all paragraphs; otherwise just this one
  const allParagraphs = groupedParagraphs.length > 0 ? groupedParagraphs : [paragraph];
  const isGrouped = groupedParagraphs.length > 1;
  
  // Calculate totals for grouped paragraphs
  const totalWordCount = allParagraphs.reduce((sum, p) => sum + p.word_count, 0);
  const totalReadingTime = allParagraphs.reduce((sum, p) => sum + p.reading_time_seconds, 0);
  const allQuestions = allParagraphs.flatMap(p => p.questions);
  const hasQuestions = allQuestions.length > 0;
  const hasFinalQuestions = allQuestions.some(q => q.is_final_question);

  // Check for extra content in questions (image, scripture, or note references)
  // "both" means the question has both image AND scripture in the same parenthesis
  const hasImageContent = allQuestions.some(q => q.content_type === 'image' || q.content_type === 'both');
  const hasScriptureContent = allQuestions.some(q => q.content_type === 'scripture' || q.content_type === 'both');
  const hasNoteContent = allQuestions.some(q => q.content_type === 'note');

  // Get estimated time for this paragraph group (apply scale factor for proportional adjustment)
  const estimatedTime = isGrouped 
    ? allParagraphs.reduce((sum, p) => sum + ((p.total_time_seconds || 0) * scaleFactor), 0)
    : (paragraphTimes.adjustedDuration || (paragraph.total_time_seconds * scaleFactor));
  const isOverTime = paragraphElapsed > estimatedTime;

  // Auto-scroll to current paragraph
  useEffect(() => {
    if (isCurrentParagraph && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCurrentParagraph]);

  // Overtime alert - trigger once when time is exceeded
  useEffect(() => {
    if (isOverTime && !overtimeAlertTriggered && overtimeAlertEnabled && isCurrentParagraph) {
      setOvertimeAlertTriggered(true);
      
      // Play sound if enabled
      if (soundEnabled && playNotificationSound) {
        playNotificationSound('urgent');
      }
      
      // Trigger vibration if enabled
      if (vibrationEnabled && triggerVibration) {
        triggerVibration([200, 100, 200, 100, 200]);
      }
    }
  }, [isOverTime, overtimeAlertTriggered, overtimeAlertEnabled, isCurrentParagraph, soundEnabled, vibrationEnabled, playNotificationSound, triggerVibration]);

  // Reset overtime alert when paragraph changes
  useEffect(() => {
    if (!isCurrentParagraph) {
      setOvertimeAlertTriggered(false);
    }
  }, [isCurrentParagraph]);

  // Paragraph timer - starts when this becomes the current paragraph
  useEffect(() => {
    if (isCurrentParagraph && isTimerRunning) {
      // Reset timer when this paragraph becomes active
      setParagraphElapsed(0);
      setOvertimeAlertTriggered(false);
      
      // Start counting
      paragraphTimerRef.current = setInterval(() => {
        setParagraphElapsed(prev => prev + 1);
      }, 1000);
    } else {
      // Stop timer when not current or not running
      if (paragraphTimerRef.current) {
        clearInterval(paragraphTimerRef.current);
        paragraphTimerRef.current = null;
      }
      // Reset when no longer current
      if (!isCurrentParagraph) {
        setParagraphElapsed(0);
      }
    }

    return () => {
      if (paragraphTimerRef.current) {
        clearInterval(paragraphTimerRef.current);
      }
    };
  }, [isCurrentParagraph, isTimerRunning]);

  // Format paragraph elapsed time as MM:SS
  const formatParagraphTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div 
        ref={cardRef}
        className={`
          group relative p-5 rounded-2xl border-2 transition-all duration-300 hover:shadow-md
          ${isCompletedParagraph
            ? darkMode 
              ? 'border-zinc-600 bg-zinc-800/50 opacity-70'
              : 'border-slate-200 bg-slate-50/50 opacity-70'
            : isCurrentParagraph 
              ? isOverTime
                ? 'border-red-400 bg-red-50 shadow-lg shadow-red-100 scale-[1.01]'
                : 'border-green-400 bg-green-50 shadow-lg shadow-green-100 scale-[1.01]' 
              : hasFinalQuestions 
                ? darkMode
                  ? 'border-red-600 bg-red-950/50 hover:border-red-500'
                  : 'border-red-200 bg-red-50/30 hover:border-red-300' 
                : hasQuestions 
                  ? darkMode
                    ? 'border-orange-600 bg-zinc-800 hover:border-orange-500'
                    : 'border-orange-100 bg-white hover:border-orange-300' 
                  : darkMode
                    ? 'border-zinc-500 bg-zinc-800 hover:border-zinc-400'
                    : 'border-slate-100 bg-white hover:border-slate-300'
          }
        `}
        style={{ animationDelay: `${index * 50}ms` }}
        data-testid={`paragraph-card-${paragraph.number}`}
      >
        {/* Completed Indicator */}
        {isCompletedParagraph && (
          <div className={`absolute top-0 left-0 right-0 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 rounded-t-xl ${
            darkMode ? 'bg-zinc-600' : 'bg-slate-500'
          }`}>
            <Check className="w-3.5 h-3.5" />
            COMPLETADO
          </div>
        )}

        {/* Current Paragraph Indicator with Timer - Redesigned */}
        {isCurrentParagraph && (
          <div className={`absolute top-0 left-0 right-0 text-white text-xs font-bold rounded-t-2xl transition-colors ${
            isOverTime 
              ? 'bg-gradient-to-r from-red-500 to-red-600' 
              : 'bg-gradient-to-r from-green-500 to-green-600'
          }`}>
            {/* Main row */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isOverTime ? 'bg-red-200' : 'bg-white'}`}></span>
                </span>
                <span className="text-[11px] sm:text-xs tracking-wide">
                  {isOverTime ? 'TIEMPO EXCEDIDO' : 'LEYENDO'}
                </span>
              </div>
              
              {/* Timer display - elegant and minimal */}
              {isTimerRunning && (
                <div className={`flex items-baseline gap-1 px-3 py-1.5 rounded-full backdrop-blur-sm ${
                  isOverTime ? 'bg-red-500/40' : 'bg-black/20'
                }`}>
                  <span className="font-light text-lg tracking-wide tabular-nums">
                    {formatParagraphTime(paragraphElapsed)}
                  </span>
                  <span className="text-sm opacity-50 mx-0.5">/</span>
                  <span className="font-light text-lg tracking-wide tabular-nums opacity-70">
                    {formatParagraphTime(Math.round(estimatedTime))}
                  </span>
                </div>
              )}
            </div>
            
            {/* Overtime badge - separate row */}
            {isOverTime && (
              <div className="px-4 pb-2 -mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-700 text-white text-[10px] font-bold rounded-full animate-pulse">
                  ⚠️ +{formatParagraphTime(paragraphElapsed - Math.round(estimatedTime))} excedido
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content Container - Dynamic padding based on header state */}
        <div className={
          isCurrentParagraph 
            ? (isOverTime ? 'pt-20' : 'pt-16') 
            : isCompletedParagraph 
              ? 'pt-10' 
              : ''
        }>
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${
                isCompletedParagraph 
                  ? darkMode ? 'text-zinc-400' : 'text-slate-400' 
                  : isCurrentParagraph 
                    ? 'text-green-700' 
                    : darkMode ? 'text-zinc-100' : 'text-slate-700'
              }`}>
                {isGrouped ? (
                  <>Párrafos {allParagraphs.map(p => p.number).join(', ')}</>
                ) : (
                  <>Párrafo {paragraph.number}</>
                )}
              </span>
              
              {/* Extra Content Badges - Between paragraph number and time */}
              {hasImageContent && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  darkMode 
                    ? 'bg-purple-900/70 text-purple-200 border border-purple-700' 
                    : 'bg-purple-100 text-purple-700 border border-purple-200'
                }`} data-testid={`image-badge-${paragraph.number}`}>
                  <Image className="w-3.5 h-3.5" />
                  Contiene imagen
                </span>
              )}
              {hasScriptureContent && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  darkMode 
                    ? 'bg-blue-900/70 text-blue-200 border border-blue-700' 
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`} data-testid={`scripture-badge-${paragraph.number}`}>
                  <BookOpen className="w-3.5 h-3.5" />
                  Texto para leer
                </span>
              )}
              {hasNoteContent && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  darkMode 
                    ? 'bg-amber-900/70 text-amber-200 border border-amber-700' 
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`} data-testid={`note-badge-${paragraph.number}`}>
                  <MessageCircleQuestion className="w-3.5 h-3.5" />
                  Nota para comentar
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Individual show/hide content button - more spacing */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContent(!showContent);
                }}
                className={`rounded-full p-2.5 h-auto transition-all ${
                  showContent
                    ? darkMode 
                      ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                    : darkMode 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-green-400 hover:bg-green-500 text-white'
                }`}
                title={showContent ? 'Ocultar contenido' : 'Mostrar contenido'}
                data-testid={`toggle-content-${paragraph.number}`}
              >
                {showContent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Badge 
                className={`font-mono text-sm px-3 py-1.5 ${
                  isCompletedParagraph 
                    ? darkMode ? 'bg-zinc-600 text-zinc-300' : 'bg-slate-200 text-slate-600' 
                    : isCurrentParagraph ? 'bg-green-500 text-white' : 
                    hasFinalQuestions ? 'bg-red-500 text-white' :
                    hasQuestions 
                      ? darkMode ? 'bg-orange-700 text-orange-100' : 'bg-orange-100 text-orange-700' 
                      : darkMode ? 'bg-zinc-600 text-zinc-100' : 'bg-slate-100 text-slate-600'
                }`}
                data-testid={`paragraph-time-${paragraph.number}`}
              >
                {formatTimeText(Math.round(estimatedTime))}
              </Badge>
            </div>
          </div>

          {/* Time Schedule */}
          {startTime && paragraphTimes.start && !isCompletedParagraph && showContent && (
            <div className="mb-4 flex items-center gap-3 text-xs">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                isCurrentParagraph 
                  ? 'bg-green-100' 
                  : darkMode ? 'bg-zinc-700 border border-zinc-600' : 'bg-slate-100'
              }`}>
                <Clock className={`w-3.5 h-3.5 ${
                  isCurrentParagraph 
                    ? 'text-green-600' 
                    : darkMode ? 'text-zinc-300' : 'text-slate-500'
                }`} />
                <span className={
                  isCurrentParagraph 
                    ? 'text-green-700 font-medium' 
                    : darkMode ? 'text-zinc-200' : 'text-slate-600'
                }>
                  {formatClockTime(paragraphTimes.start)} - {formatClockTime(paragraphTimes.end)}
                </span>
              </div>
              {paragraphTimes.adjustedDuration !== paragraph.total_time_seconds && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  darkMode ? 'text-orange-300 bg-orange-900' : 'text-orange-500 bg-orange-50'
                }`}>
                  ajustado
                </span>
              )}
            </div>
          )}
          
          {/* Paragraph Text - Show all paragraphs if grouped */}
          {showContent && (
            <>
              {isGrouped ? (
                <div className="space-y-4">
                  {allParagraphs.map((p, idx) => (
                    <div key={p.number} className={idx > 0 ? `pt-4 border-t ${darkMode ? 'border-zinc-600' : 'border-slate-200'}` : ''}>
                      <p className={`text-xs font-semibold mb-1 ${
                        isCompletedParagraph 
                          ? darkMode ? 'text-zinc-400' : 'text-slate-400' 
                          : darkMode ? 'text-zinc-300' : 'text-slate-500'
                      }`}>
                        Párrafo {p.number}:
                      </p>
                      <p className={`text-sm leading-relaxed ${
                        isCompletedParagraph 
                          ? darkMode ? 'text-zinc-400' : 'text-slate-400' 
                          : isCurrentParagraph 
                            ? 'text-slate-800' 
                            : darkMode ? 'text-zinc-100' : 'text-slate-600'
                      }`}>
                        {p.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm leading-relaxed ${
                  isCompletedParagraph 
                    ? darkMode ? 'text-zinc-400' : 'text-slate-400' 
                    : isCurrentParagraph 
                      ? 'text-slate-800' 
                      : darkMode ? 'text-zinc-100' : 'text-slate-600'
                }`}>
                  {paragraph.text}
                </p>
              )}
            </>
          )}
          
          {/* Stats Row - Centered on mobile */}
          <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-4 text-xs ${
            isCompletedParagraph 
              ? darkMode ? 'text-zinc-400' : 'text-slate-400' 
              : darkMode ? 'text-zinc-300' : 'text-slate-500'
          }`}>
            <span className={`px-2.5 py-1.5 rounded-full ${darkMode ? 'bg-zinc-700 border border-zinc-600' : 'bg-slate-50'}`}>{totalWordCount} palabras</span>
            <span className={`px-2.5 py-1.5 rounded-full ${darkMode ? 'bg-zinc-700 border border-zinc-600' : 'bg-slate-50'}`}>{formatTimeText(totalReadingTime)} lectura</span>
            {hasQuestions && (
              <span className={`px-2.5 py-1.5 rounded-full font-medium ${
                hasFinalQuestions 
                  ? darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-600' 
                  : darkMode ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-600'
              }`}>
                {allQuestions.length} pregunta{allQuestions.length > 1 ? 's' : ''}
              </span>
            )}
            {isGrouped && (
              <span className={`px-2.5 py-1.5 rounded-full font-medium ${
                darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-600'
              }`}>
                {allParagraphs.length} párrafos agrupados
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {/* Left side - Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Next Paragraph Button - Primary Action */}
              {isCurrentParagraph && !isLastParagraph && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToNext();
                  }}
                  className="rounded-full px-6 py-5 text-sm font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200 hover:shadow-green-300 transition-all active:scale-95"
                  data-testid={`next-from-paragraph-${paragraph.number}`}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Siguiente Párrafo
                </Button>
              )}

              {/* Go to Review Questions Button - For Last Paragraph */}
              {isCurrentParagraph && isLastParagraph && hasReviewQuestions && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartReview?.();
                  }}
                  className="rounded-full px-6 py-5 text-sm font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 hover:shadow-red-300 transition-all active:scale-95"
                  data-testid="start-review-questions"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Pasar a Preguntas de Repaso
                </Button>
              )}

              {/* Start from here Button - Secondary Action */}
              {!isCurrentParagraph && !isCompletedParagraph && (
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartFromHere();
                  }}
                  className={`rounded-full px-5 py-4 text-sm font-semibold border-2 transition-all ${
                    darkMode 
                      ? 'border-zinc-500 text-zinc-100 hover:border-orange-500 hover:text-orange-400 hover:bg-orange-500/10' 
                      : 'border-slate-300 text-slate-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                  data-testid={`start-from-paragraph-${paragraph.number}`}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar desde aquí
                </Button>
              )}
            </div>

            {/* Right side - Questions Toggle button */}
            {hasQuestions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                  isOpen 
                    ? hasFinalQuestions 
                      ? 'bg-red-500 text-white' 
                      : 'bg-orange-500 text-white'
                    : ''
                }`}
                style={{
                  backgroundColor: isOpen ? undefined : 'transparent',
                  color: isOpen 
                    ? '#ffffff' 
                    : (hasFinalQuestions 
                        ? (darkMode ? '#f87171' : '#dc2626')
                        : (darkMode ? '#fb923c' : '#ea580c')),
                  borderColor: hasFinalQuestions 
                    ? (darkMode ? '#f87171' : '#ef4444')
                    : (darkMode ? '#fb923c' : '#f97316'),
                  borderWidth: '2.5px',
                  borderStyle: 'solid',
                }}
                data-testid={`toggle-questions-${paragraph.number}`}
              >
                <MessageCircleQuestion className="w-4 h-4" />
                {isOpen ? 'Ocultar' : `${allQuestions.length} pregunta${allQuestions.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          {/* Questions Section */}
          {hasQuestions && (
            <CollapsibleContent>
              <div className={`mt-4 space-y-2 pl-2 border-l-2 ${darkMode ? 'border-orange-700' : 'border-orange-200'}`}>
                {allQuestions.map((q, qIndex) => {
                  const displayTime = isTimerRunning && adjustedQuestionTime ? adjustedQuestionTime : q.answer_time;
                  const isAdjusted = isTimerRunning && adjustedQuestionTime && adjustedQuestionTime !== 35;
                  const timeDiff = adjustedQuestionTime ? adjustedQuestionTime - 35 : 0;
                  const isLowTime = isTimerRunning && adjustedQuestionTime && adjustedQuestionTime < 20;
                  const formattedTime = formatTimeCompact(displayTime);
                  const hasExtraContent = q.parenthesis_content && q.parenthesis_content.length > 0;
                  
                  return (
                    <div 
                      key={qIndex}
                      className={`rounded-xl py-3 px-4 text-sm ${
                        q.is_final_question 
                          ? darkMode 
                            ? 'bg-red-950 text-red-200 border border-red-800' 
                            : 'bg-red-50 text-red-800 border border-red-200' 
                          : isLowTime
                            ? darkMode 
                              ? 'bg-orange-950 text-orange-200 border border-orange-700'
                              : 'bg-orange-100 text-orange-900 border border-orange-300'
                            : darkMode 
                              ? 'bg-orange-950/50 text-orange-200 border border-orange-800'
                              : 'bg-orange-50 text-orange-800 border border-orange-100'
                      }`}
                      data-testid={`question-${paragraph.number}-${qIndex}`}
                    >
                      <div className="flex items-start gap-2">
                        <MessageCircleQuestion className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          q.is_final_question 
                            ? darkMode ? 'text-red-400' : 'text-red-500' 
                            : darkMode ? 'text-orange-400' : 'text-orange-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <span>{q.text}</span>
                              {/* Show parenthesis content inline */}
                              {hasExtraContent && (
                                <span className={`ml-1 ${
                                  darkMode ? 'text-zinc-400' : 'text-slate-500'
                                }`}>
                                  ({q.parenthesis_content})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <span className={`text-xs font-light px-2 py-0.5 rounded-full ${
                                isLowTime 
                                  ? darkMode ? 'bg-orange-800 text-orange-200' : 'bg-orange-200 text-orange-700' 
                                  : q.is_final_question 
                                    ? darkMode ? 'text-red-400' : 'text-red-500' 
                                    : isAdjusted
                                      ? timeDiff > 0 
                                        ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700' 
                                        : darkMode ? 'bg-orange-900 text-orange-300' : 'bg-orange-100 text-orange-700'
                                      : darkMode ? 'text-orange-400' : 'text-orange-500'
                              }`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                +{formattedTime}
                              </span>
                              {isAdjusted && (
                                <span className={`text-[10px] ${
                                  timeDiff > 0 
                                    ? darkMode ? 'text-green-400' : 'text-green-600' 
                                    : darkMode ? 'text-orange-400' : 'text-orange-600'
                                }`}>
                                  ({timeDiff > 0 ? '+' : ''}{formatTimeCompact(Math.abs(timeDiff))})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
