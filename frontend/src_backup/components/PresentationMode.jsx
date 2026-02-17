import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X,
  Timer,
  Palette,
  Mic,
  BookOpen,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  Image,
  Layers,
  MessageCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatTime, formatClockTime, formatTimeCompact } from "../utils/timeFormatters";

// Theme configurations
const THEMES = {
  dark: {
    name: "🌙 Oscuro",
    bg: "bg-zinc-900",
    text: "text-white",
    textMuted: "text-zinc-400",
    textDimmed: "text-zinc-500",
    border: "border-zinc-800",
    card: "bg-zinc-800/50",
    accent: "text-orange-500",
    accentBg: "bg-orange-500",
    success: "text-green-400",
    warning: "text-orange-400",
    danger: "text-red-400",
    progressBg: "bg-zinc-800",
    buttonOutline: "border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500",
    kbd: "bg-zinc-800 text-zinc-400"
  },
  light: {
    name: "☀️ Claro",
    bg: "bg-white",
    text: "text-zinc-900",
    textMuted: "text-zinc-600",
    textDimmed: "text-zinc-400",
    border: "border-zinc-200",
    card: "bg-zinc-100",
    accent: "text-orange-600",
    accentBg: "bg-orange-500",
    success: "text-green-600",
    warning: "text-orange-600",
    danger: "text-red-600",
    progressBg: "bg-zinc-200",
    buttonOutline: "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400",
    kbd: "bg-zinc-200 text-zinc-600"
  },
  blue: {
    name: "🌊 Azul Océano",
    bg: "bg-slate-900",
    text: "text-white",
    textMuted: "text-slate-400",
    textDimmed: "text-slate-500",
    border: "border-slate-700",
    card: "bg-slate-800/50",
    accent: "text-cyan-400",
    accentBg: "bg-cyan-500",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
    progressBg: "bg-slate-800",
    buttonOutline: "border-slate-600 text-slate-400 hover:text-white hover:border-slate-500",
    kbd: "bg-slate-800 text-slate-400"
  },
  amoled: {
    name: "📱 AMOLED Negro",
    bg: "bg-black",
    text: "text-white",
    textMuted: "text-zinc-400",
    textDimmed: "text-zinc-500",
    border: "border-zinc-800",
    card: "bg-zinc-950",
    accent: "text-orange-500",
    accentBg: "bg-orange-500",
    success: "text-green-500",
    warning: "text-orange-500",
    danger: "text-red-500",
    progressBg: "bg-zinc-950",
    buttonOutline: "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600",
    kbd: "bg-zinc-950 text-zinc-400"
  }
};

// Study phases
const PHASES = {
  INTRO: 'intro',
  PARAGRAPHS: 'paragraphs',
  REVIEW: 'review',
  CONCLUSION: 'conclusion',
  FINISHED: 'finished'
};

export default function PresentationMode({
  analysisResult,
  elapsedTime,
  remainingTime,
  isTimerRunning,
  onToggleTimer,
  onResetTimer,
  onExit,
  currentParagraphIndex = 0,
  theme = 'dark',
  onThemeChange,
  totalDurationSeconds = 3600,
  startTime,
  endTime,
  introductionTime = 60,
  conclusionTime = 60,
  onStartStudy,
  studyPhase = 'intro',
  onPhaseChange,
  externalReviewQuestion = 0,
  onReviewQuestionChange
}) {
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  
  // Use external state - the phase is managed by HomePage
  const setStudyPhase = onPhaseChange || (() => {});
  
  const currentReviewQuestion = externalReviewQuestion;
  const setCurrentReviewQuestion = onReviewQuestionChange || (() => {});
  
  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setPhaseElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);
  
  useEffect(() => {
    setPhaseElapsed(0);
  }, [studyPhase, currentParagraphIndex, currentReviewQuestion]);

  // Group paragraphs that belong together based on "grouped_with" field
  const paragraphGroups = useMemo(() => {
    if (!analysisResult?.paragraphs) return [];
    
    const paragraphs = analysisResult.paragraphs;
    const groups = [];
    const processedIndices = new Set();
    
    paragraphs.forEach((para, index) => {
      if (processedIndices.has(index)) return;
      
      const groupedWith = para.grouped_with || [];
      
      if (groupedWith.length > 1) {
        // This paragraph is part of a group
        const groupParagraphs = groupedWith
          .map(num => paragraphs.find(p => p.number === num))
          .filter(Boolean);
        
        // Mark all paragraphs in this group as processed
        groupParagraphs.forEach(gp => {
          const gIndex = paragraphs.findIndex(p => p.number === gp.number);
          processedIndices.add(gIndex);
        });
        
        // Only add the group once (when we encounter the first paragraph of the group)
        if (para.number === Math.min(...groupedWith)) {
          groups.push({
            type: 'group',
            paragraphs: groupParagraphs,
            numbers: groupParagraphs.map(p => p.number),
            indices: groupParagraphs.map(gp => paragraphs.findIndex(p => p.number === gp.number)),
            // Combined stats
            totalTime: groupParagraphs.reduce((sum, p) => sum + (p.total_time_seconds || 0), 0),
            totalWords: groupParagraphs.reduce((sum, p) => sum + (p.word_count || 0), 0),
            allQuestions: groupParagraphs.flatMap(p => p.questions || [])
          });
        }
      } else {
        // Single paragraph
        processedIndices.add(index);
        groups.push({
          type: 'single',
          paragraphs: [para],
          numbers: [para.number],
          indices: [index],
          totalTime: para.total_time_seconds || 0,
          totalWords: para.word_count || 0,
          allQuestions: para.questions || []
        });
      }
    });
    
    return groups;
  }, [analysisResult?.paragraphs]);

  // Current group index based on currentParagraphIndex
  const currentGroupIndex = useMemo(() => {
    for (let i = 0; i < paragraphGroups.length; i++) {
      if (paragraphGroups[i].indices.includes(currentParagraphIndex)) {
        return i;
      }
    }
    return 0;
  }, [paragraphGroups, currentParagraphIndex]);

  // Current group
  const currentGroup = useMemo(() => {
    return paragraphGroups[currentGroupIndex] || null;
  }, [paragraphGroups, currentGroupIndex]);

  // Next group (for showing alerts)
  const nextGroup = useMemo(() => {
    return paragraphGroups[currentGroupIndex + 1] || null;
  }, [paragraphGroups, currentGroupIndex]);

  // Current paragraph (first of current group for compatibility)
  const currentParagraph = useMemo(() => {
    if (!currentGroup) return null;
    return currentGroup.paragraphs[0] || null;
  }, [currentGroup]);
  
  // Next paragraph (first of next group for alerts)
  const nextParagraph = useMemo(() => {
    if (!nextGroup) return null;
    return nextGroup.paragraphs[0] || null;
  }, [nextGroup]);
  
  // Check if next GROUP has special content ("both" means image AND scripture)
  const nextParagraphHasImage = useMemo(() => {
    if (!nextGroup) return false;
    return nextGroup.allQuestions?.some(q => q.content_type === 'image' || q.content_type === 'both') || false;
  }, [nextGroup]);
  
  const nextParagraphHasScripture = useMemo(() => {
    if (!nextGroup) return false;
    return nextGroup.allQuestions?.some(q => q.content_type === 'scripture' || q.content_type === 'both') || false;
  }, [nextGroup]);
  
  // Current GROUP has special content
  const currentParagraphHasImage = useMemo(() => {
    if (!currentGroup) return false;
    return currentGroup.allQuestions?.some(q => q.content_type === 'image' || q.content_type === 'both') || false;
  }, [currentGroup]);
  
  const currentParagraphHasScripture = useMemo(() => {
    if (!currentGroup) return false;
    return currentGroup.allQuestions?.some(q => q.content_type === 'scripture' || q.content_type === 'both') || false;
  }, [currentGroup]);
  
  const currentReviewQuestionData = useMemo(() => {
    if (!analysisResult || !analysisResult.final_questions) return null;
    return analysisResult.final_questions[currentReviewQuestion] || null;
  }, [analysisResult, currentReviewQuestion]);
  
  const progressPercentage = useMemo(() => {
    return Math.min(100, (elapsedTime / totalDurationSeconds) * 100);
  }, [elapsedTime, totalDurationSeconds]);
  
  // Article stats
  const articleStats = useMemo(() => {
    if (!analysisResult) return { paragraphs: 0, questions: 0, images: 0, scriptures: 0, review: 0 };
    return {
      paragraphs: analysisResult.total_paragraphs || 0,
      questions: analysisResult.total_paragraph_questions || analysisResult.paragraphs?.reduce((sum, p) => sum + p.questions?.length || 0, 0) || 0,
      images: analysisResult.total_images || 0,
      scriptures: analysisResult.total_scriptures || 0,
      review: analysisResult.final_questions?.length || 0
    };
  }, [analysisResult]);
  
  const isLowTime = remainingTime <= 300;
  const isOvertime = remainingTime <= 0;
  
  const t = THEMES[theme] || THEMES.dark;
  
  // Get phase-specific info - using groups for paragraphs
  const getPhaseInfo = () => {
    switch (studyPhase) {
      case PHASES.INTRO:
        return {
          title: "Palabras de Introducción",
          icon: Mic,
          color: "text-blue-400",
          bgColor: "bg-blue-500",
          estimatedTime: introductionTime,
          subtitle: "El conductor introduce el tema del artículo"
        };
      case PHASES.PARAGRAPHS:
        // Use group info for title and time
        const groupNumbers = currentGroup?.numbers || [currentParagraph?.number || 1];
        const isGrouped = groupNumbers.length > 1;
        const groupTitle = isGrouped 
          ? `Párrafos ${groupNumbers.join(', ')}` 
          : `Párrafo ${groupNumbers[0]}`;
        return {
          title: groupTitle,
          icon: BookOpen,
          color: "text-green-400",
          bgColor: "bg-green-500",
          estimatedTime: currentGroup?.totalTime || currentParagraph?.total_time_seconds || 60,
          subtitle: `de ${analysisResult?.total_paragraphs || 0} párrafos`
        };
      case PHASES.REVIEW:
        return {
          title: `Pregunta de Repaso ${currentReviewQuestion + 1}`,
          icon: HelpCircle,
          color: "text-red-400",
          bgColor: "bg-red-500",
          estimatedTime: currentReviewQuestionData?.answer_time || 35,
          subtitle: `de ${analysisResult?.final_questions?.length || 0} preguntas`
        };
      case PHASES.CONCLUSION:
        return {
          title: "Palabras de Conclusión",
          icon: Sparkles,
          color: "text-purple-400",
          bgColor: "bg-purple-500",
          estimatedTime: conclusionTime,
          subtitle: "El conductor resume y anima a la congregación"
        };
      case PHASES.FINISHED:
        return {
          title: "¡Estudio Finalizado!",
          icon: CheckCircle2,
          color: "text-green-400",
          bgColor: "bg-green-500",
          estimatedTime: 0,
          subtitle: "Gracias por tu dedicación"
        };
      default:
        return { title: "", icon: Timer, color: "", bgColor: "", estimatedTime: 0, subtitle: "" };
    }
  };
  
  const phaseInfo = getPhaseInfo();
  const PhaseIcon = phaseInfo.icon;
  const isPhaseOvertime = phaseElapsed > phaseInfo.estimatedTime;
  
  // Navigation handlers
  const handleStartStudy = () => {
    if (onStartStudy) {
      onStartStudy();
    } else {
      onToggleTimer();
    }
    setStudyPhase(PHASES.INTRO);
  };
  
  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onExit();
      }
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        if (studyPhase === PHASES.INTRO && !isTimerRunning) {
          handleStartStudy();
        } else {
          onToggleTimer();
        }
      }
      // Removed arrow key navigation - navigation is done from main screen
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, onToggleTimer, studyPhase, isTimerRunning]);

  const formatRemainingTime = (seconds) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    
    if (hours > 0) {
      return `${isNegative ? '-' : ''}${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${isNegative ? '-' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] ${t.bg} ${t.text} flex flex-col`}
      data-testid="presentation-mode"
    >
      {/* Top Bar with Stats */}
      <div className={`flex items-center justify-between px-4 md:px-8 py-2 border-b ${t.border} shrink-0`}>
        <div className="flex items-center gap-4">
          <div className={`w-8 h-8 md:w-10 md:h-10 ${t.accentBg} rounded-xl flex items-center justify-center`}>
            <Timer className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-sm md:text-lg truncate max-w-[150px] md:max-w-none">{analysisResult.filename}</h1>
            {/* Mini Stats Row */}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] md:text-xs ${t.textMuted} flex items-center gap-1`}>
                <Layers className="w-3 h-3" />{articleStats.paragraphs}
              </span>
              <span className={`text-[10px] md:text-xs text-orange-400 flex items-center gap-1`}>
                <MessageCircle className="w-3 h-3" />{articleStats.questions}
              </span>
              {articleStats.images > 0 && (
                <span className={`text-[10px] md:text-xs text-purple-400 flex items-center gap-1`}>
                  <Image className="w-3 h-3" />{articleStats.images}
                </span>
              )}
              {articleStats.scriptures > 0 && (
                <span className={`text-[10px] md:text-xs text-blue-400 flex items-center gap-1`}>
                  <BookOpen className="w-3 h-3" />{articleStats.scriptures}
                </span>
              )}
              {articleStats.review > 0 && (
                <span className={`text-[10px] md:text-xs text-red-400 flex items-center gap-1`}>
                  <HelpCircle className="w-3 h-3" />{articleStats.review}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={`${t.textMuted} hover:${t.text}`}>
                <Palette className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Tema</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Seleccionar Tema</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(THEMES).map(([key, value]) => (
                <DropdownMenuItem key={key} onClick={() => onThemeChange(key)} className={theme === key ? 'bg-accent' : ''}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${value.accentBg}`} />
                    <span>{value.name}</span>
                    {theme === key && <span className="ml-auto">✓</span>}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" onClick={onExit} className={`${t.textMuted} hover:${t.text}`}>
            <X className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Salir</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-4 overflow-auto">
        
        {/* Time Schedule */}
        <div className={`${t.card} rounded-2xl px-6 md:px-12 py-4 md:py-5 mb-4 border ${t.border} w-full max-w-xl`}>
          <div className="flex items-center justify-center gap-6 md:gap-14">
            <div className="text-center">
              <span className="text-[10px] md:text-xs font-bold text-emerald-400 uppercase tracking-widest">Inicio</span>
              <p className={`text-2xl md:text-4xl font-bold mt-1 ${startTime ? 'text-emerald-400' : 'text-emerald-400/60'}`}
                style={{ fontFamily: 'system-ui' }}>
                {startTime ? formatClockTime(startTime) : '--:--'}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className={`w-8 md:w-14 h-px ${t.border.replace('border-', 'bg-')} opacity-60`}></div>
              <span className="text-xs md:text-sm font-bold text-orange-400 my-1">{Math.round(totalDurationSeconds / 60)} min</span>
              <div className={`w-8 md:w-14 h-px ${t.border.replace('border-', 'bg-')} opacity-60`}></div>
            </div>
            <div className="text-center">
              <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${isOvertime ? 'text-rose-400' : isLowTime ? 'text-rose-400' : 'text-amber-400'}`}>Fin</span>
              <p className={`text-2xl md:text-4xl font-bold mt-1 ${
                !endTime ? 'text-amber-400/60' : isOvertime ? 'text-rose-400 animate-pulse' : isLowTime ? 'text-rose-400' : 'text-amber-400'
              }`} style={{ fontFamily: 'system-ui' }}>
                {endTime ? formatClockTime(endTime) : '--:--'}
              </p>
            </div>
          </div>
        </div>

        {/* Current Phase Card with Progress Indicator */}
        <div className={`w-full max-w-xl ${t.card} rounded-2xl p-4 md:p-5 mb-4 border ${t.border}`}>
          {/* Paragraph Progress Indicator (only for paragraphs phase) */}
          {studyPhase === PHASES.PARAGRAPHS && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${t.textMuted}`}>Progreso de párrafos</span>
                <span className={`text-sm font-bold ${phaseInfo.color} bg-green-500/20 px-3 py-1 rounded-full`}>
                  {currentGroup?.numbers?.length > 1 
                    ? `${currentGroup.numbers.join(', ')} de ${articleStats.paragraphs}`
                    : `${currentGroup?.numbers?.[0] || currentParagraphIndex + 1} de ${articleStats.paragraphs}`
                  }
                </span>
              </div>
              {/* Visual paragraph progress bar - shows GROUPS, not individual paragraphs */}
              <div className="flex gap-1.5 flex-wrap">
                {paragraphGroups.map((group, groupIdx) => {
                  const hasImg = group.allQuestions?.some(q => q.content_type === 'image' || q.content_type === 'both');
                  const hasTxt = group.allQuestions?.some(q => q.content_type === 'scripture' || q.content_type === 'both');
                  const isCurrent = groupIdx === currentGroupIndex;
                  const isCompleted = groupIdx < currentGroupIndex;
                  const isGrouped = group.numbers.length > 1;
                  
                  return (
                    <div 
                      key={groupIdx}
                      className={`h-3 rounded-full transition-all relative ${
                        isCurrent 
                          ? `${isGrouped ? 'w-14' : 'w-10'} bg-green-500 shadow-lg shadow-green-500/50` 
                          : isCompleted 
                            ? `${isGrouped ? 'w-6' : 'w-4'} bg-green-500/60` 
                            : hasImg && hasTxt
                              ? `${isGrouped ? 'w-6' : 'w-4'} bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-pulse`
                              : hasImg
                                ? `${isGrouped ? 'w-6' : 'w-4'} bg-purple-500/80`
                                : hasTxt
                                  ? `${isGrouped ? 'w-6' : 'w-4'} bg-blue-500/80`
                                  : `${isGrouped ? 'w-6' : 'w-4'} ${t.progressBg}`
                      }`}
                      title={`${isGrouped ? 'Párrafos' : 'Párrafo'} ${group.numbers.join(', ')}${hasImg ? ' 🖼️' : ''}${hasTxt ? ' 📖' : ''}`}
                    >
                      {isCurrent && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-green-400 whitespace-nowrap">
                          {group.numbers.join(',')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className={`text-[10px] ${t.textMuted}`}>Imagen</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className={`text-[10px] ${t.textMuted}`}>Texto</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className={`text-[10px] ${t.textMuted}`}>Actual</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Review Progress (for review phase) */}
          {studyPhase === PHASES.REVIEW && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${t.textMuted}`}>Progreso de repaso</span>
                <span className={`text-xs font-bold text-red-400`}>
                  {currentReviewQuestion + 1} / {articleStats.review}
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: articleStats.review }).map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentReviewQuestion 
                        ? 'w-6 bg-red-500' 
                        : idx < currentReviewQuestion 
                          ? 'w-2 bg-red-500/50' 
                          : `w-2 ${t.progressBg}`
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Phase Info */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${phaseInfo.bgColor} rounded-xl flex items-center justify-center shadow-lg`}>
              <PhaseIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className={`text-2xl md:text-3xl font-bold ${phaseInfo.color}`}>{phaseInfo.title}</h2>
                {/* Current paragraph badges - MORE VISIBLE */}
                {studyPhase === PHASES.PARAGRAPHS && (currentParagraphHasImage || currentParagraphHasScripture) && (
                  <div className="flex gap-2">
                    {currentParagraphHasImage && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white shadow-lg shadow-purple-500/30">
                        <Image className="w-4 h-4" />
                        MOSTRAR IMAGEN
                      </span>
                    )}
                    {currentParagraphHasScripture && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                        <BookOpen className="w-4 h-4" />
                        LEER TEXTO
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className={`text-sm ${t.textMuted} mt-1`}>{phaseInfo.subtitle}</p>
            </div>
            {studyPhase !== PHASES.FINISHED && (
              <div className="text-right">
                <p className={`text-3xl md:text-4xl font-bold ${isPhaseOvertime ? 'text-red-400' : t.text}`}>
                  {formatTimeCompact(phaseElapsed)}
                </p>
                <p className={`text-sm ${t.textDimmed}`}>/ {formatTimeCompact(phaseInfo.estimatedTime)}</p>
              </div>
            )}
          </div>
          
          {/* Phase Progress Bar */}
          {studyPhase !== PHASES.FINISHED && phaseInfo.estimatedTime > 0 && (
            <div className={`h-2 rounded-full ${t.progressBg} overflow-hidden mt-4`}>
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isPhaseOvertime ? 'bg-red-500' : phaseInfo.bgColor
                }`}
                style={{ width: `${Math.min(100, (phaseElapsed / phaseInfo.estimatedTime) * 100)}%` }}
              />
            </div>
          )}
          
          {/* Question text for review phase */}
          {studyPhase === PHASES.REVIEW && currentReviewQuestionData && (
            <div className={`mt-4 p-4 rounded-xl ${t.progressBg}`}>
              <p className={`text-sm md:text-base ${t.text}`}>{currentReviewQuestionData.text}</p>
              {currentReviewQuestionData.parenthesis_content && (
                <p className={`text-xs mt-2 ${t.textMuted}`}>({currentReviewQuestionData.parenthesis_content})</p>
              )}
            </div>
          )}
        </div>

        {/* Main Timers - BIGGER */}
        <div className="flex items-center justify-center gap-8 md:gap-16 mb-6 w-full">
          <div className="text-center flex-1 max-w-xs">
            <p className={`text-sm md:text-base font-medium ${t.textDimmed} mb-2`}>Transcurrido</p>
            <div className={`text-5xl md:text-7xl font-light tracking-tight ${isTimerRunning ? t.accent : t.text}`}
              style={{ fontFamily: 'system-ui' }}>
              {formatTime(elapsedTime)}
            </div>
          </div>
          <div className={`w-px h-16 md:h-24 ${t.border.replace('border-', 'bg-')} opacity-30`} />
          <div className="text-center flex-1 max-w-xs">
            <p className={`text-sm md:text-base font-medium ${t.textDimmed} mb-2`}>Restante</p>
            <div className={`text-5xl md:text-7xl font-light tracking-tight ${
              isOvertime ? 'text-red-500 animate-pulse' : isLowTime ? t.danger : t.success
            }`} style={{ fontFamily: 'system-ui' }}>
              {formatRemainingTime(remainingTime)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-xl mb-4">
          <div className={`h-2 md:h-3 rounded-full ${t.progressBg} overflow-hidden`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ${isLowTime ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, progressPercentage)}%` }}
            />
          </div>
          <p className={`text-center text-sm font-bold mt-2 ${isLowTime ? t.danger : t.success}`}>
            {progressPercentage.toFixed(0)}%
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Start Study Button */}
            {studyPhase === PHASES.INTRO && !isTimerRunning && (
              <Button
                onClick={handleStartStudy}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 md:px-8 py-3 text-base md:text-lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Iniciar Estudio
              </Button>
            )}
            
            {/* Play/Pause Control Only */}
            {isTimerRunning && studyPhase !== PHASES.FINISHED && (
              <Button
                onClick={onToggleTimer}
                size="lg"
                className={`rounded-full p-0 text-white shadow-lg ${
                  isTimerRunning ? t.accentBg + ' hover:opacity-90' : 'bg-green-600 hover:bg-green-700'
                }`}
                style={{ width: '56px', height: '56px' }}
              >
                {isTimerRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>
            )}
            
            {/* Reset */}
            {(isTimerRunning || studyPhase !== PHASES.INTRO) && (
              <Button
                onClick={() => {
                  onResetTimer();
                  setStudyPhase(PHASES.INTRO);
                  setCurrentReviewQuestion(0);
                  setPhaseElapsed(0);
                }}
                variant="outline"
                size="sm"
                className={`rounded-full ${t.buttonOutline}`}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Keyboard shortcuts - simplified */}
        <p className={`text-xs ${t.textDimmed} mt-4 hidden md:block`}>
          <kbd className={`px-2 py-1 ${t.kbd} rounded`}>Espacio</kbd> iniciar/pausar · 
          <kbd className={`px-2 py-1 ${t.kbd} rounded ml-1`}>ESC</kbd> salir
        </p>
      </div>
    </div>
  );
}
