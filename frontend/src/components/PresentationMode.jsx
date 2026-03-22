import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  X,
  Mic,
  BookOpen,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  MessageSquarePlus,
  ArrowRight,
  Hand,
  Image,
  MessageCircleQuestion,
  Star,
} from "lucide-react";
import { formatTime, formatClockTime } from "@/utils/timeFormatters";

const PHASES = {
  INITIAL: "initial",
  INTRO: "intro",
  PARAGRAPHS: "paragraphs",
  REVIEW: "review",
  CONCLUSION: "conclusion",
  FINISHED: "finished",
};

export default function PresentationMode({
                                           analysisResult,
                                           elapsedTime,
                                           remainingTime,
                                           isTimerRunning,
                                           onToggleTimer,
                                           onExit,
                                           currentParagraphIndex = 0,
                                           startTime,
                                           endTime,
                                           introductionTime = 60,
                                           conclusionTime = 60,
                                           studyPhase = "initial",
                                           externalReviewQuestion = 0,
                                           phaseElapsedTime = 0,
                                           onAddComment,
                                           onStartStudy,
                                           onGoToFirstParagraph,
                                           onGoToNext,
                                           onStartReview,
                                           onNextReviewQuestion,
                                           onStartClosingWords,
                                           onFinishStudy,
                                           scaleFactor = 1,
                                           totalComments = 0,
                                           currentParagraphGroup,
                                           getAdjustedParagraphTimes,
                                         }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { phaseInfo, estimatedTime } = useMemo(() => {
    let info = { title: "Esperando para iniciar", icon: Play, subtitle: "Presiona Iniciar Estudio", estimated: 0 };
    if (studyPhase !== 'initial') {
      switch (studyPhase) {
        case PHASES.INTRO:
          info = { title: "Introducción", icon: Mic, subtitle: "Presentando el tema", estimated: introductionTime * scaleFactor };
          break;
        case PHASES.PARAGRAPHS:
          if (currentParagraphGroup && getAdjustedParagraphTimes) {
            const isGrouped = currentParagraphGroup.paragraphs.length > 1;
            const paragraphNumbers = currentParagraphGroup.paragraphs.map(p => p.number).join(', ');

            let calculatedTime = 0;
            if (isGrouped) {
              calculatedTime = currentParagraphGroup.paragraphs.reduce((sum, p) => sum + ((p.total_time_seconds || 0) * scaleFactor), 0);
            } else {
              const paragraphTimes = getAdjustedParagraphTimes(currentParagraphGroup.indices[0]);
              calculatedTime = paragraphTimes.adjustedDuration || (currentParagraphGroup.firstParagraph.total_time_seconds * scaleFactor);
            }

            info = {
              title: isGrouped ? `Párrafos ${paragraphNumbers}` : `Párrafo ${currentParagraphGroup.firstParagraph.number}`,
              icon: BookOpen,
              subtitle: `de ${analysisResult?.total_paragraphs || 0} párrafos`,
              estimated: calculatedTime
            };
          } else {
            const paragraph = analysisResult?.paragraphs[currentParagraphIndex];
            info = { title: `Párrafo ${paragraph?.number || ''}`, icon: BookOpen, subtitle: `de ${analysisResult?.total_paragraphs || 0} párrafos`, estimated: (paragraph?.total_time_seconds || 0) * scaleFactor };
          }
          break;
        case PHASES.REVIEW:
          const question = analysisResult?.final_questions[externalReviewQuestion];
          info = { title: `Pregunta ${externalReviewQuestion + 1}`, icon: HelpCircle, subtitle: `de ${analysisResult?.final_questions?.length || 0} preguntas`, estimated: (question?.answer_time || 35) * scaleFactor };
          break;
        case PHASES.CONCLUSION:
          info = { title: "Conclusión", icon: Sparkles, subtitle: "Resumen y aplicación", estimated: conclusionTime * scaleFactor };
          break;
        case PHASES.FINISHED:
          info = { title: "¡Estudio Finalizado!", icon: CheckCircle2, subtitle: "Buen trabajo", estimated: 0 };
          break;
      }
    }
    return { phaseInfo: info, estimatedTime: info.estimated };
  }, [studyPhase, currentParagraphIndex, externalReviewQuestion, analysisResult, introductionTime, conclusionTime, scaleFactor, currentParagraphGroup, getAdjustedParagraphTimes]);

  const { colorClass, indicatorText } = useMemo(() => {
    if (!isTimerRunning || estimatedTime === 0) return { colorClass: "bg-gray-600", indicatorText: "EN PAUSA" };
    const ratio = phaseElapsedTime / estimatedTime;
    if (ratio <= 1) return { colorClass: "bg-green-600", indicatorText: "EN TIEMPO" };
    if (ratio <= 1.3) return { colorClass: "bg-orange-500", indicatorText: "TIEMPO DE PRORROGA" };
    return { colorClass: "bg-red-600", indicatorText: "TIEMPO EXCEDIDO" };
  }, [phaseElapsedTime, estimatedTime, isTimerRunning]);

  // Extract content types for the current paragraph group to display badges
  const { hasImageContent, hasScriptureContent, hasNoteContent, uniqueHighlightContents } = useMemo(() => {
    if (studyPhase !== PHASES.PARAGRAPHS || !currentParagraphGroup) {
      return {};
    }

    const allQuestions = currentParagraphGroup.paragraphs.flatMap(p => p.questions);

    const highlights = allQuestions
        .filter(q => q.highlight_contents && q.highlight_contents.length > 0)
        .flatMap(q => q.highlight_contents);

    return {
      hasImageContent: allQuestions.some(q => q.content_type?.includes('image')),
      hasScriptureContent: allQuestions.some(q => q.content_type?.includes('scripture')),
      hasNoteContent: allQuestions.some(q => q.content_type?.includes('note')),
      uniqueHighlightContents: [...new Set(highlights)]
    };
  }, [studyPhase, currentParagraphGroup]);


  const handleSmartButton = () => {
    if (studyPhase === 'initial') {
      onStartStudy?.();
      return;
    }
    switch (studyPhase) {
      case PHASES.INTRO: onGoToFirstParagraph?.(); break;
      case PHASES.PARAGRAPHS:
        if (currentParagraphIndex >= (analysisResult?.paragraphs.length || 0) - 1) {
          if (analysisResult?.final_questions?.length > 0) onStartReview?.();
          else onStartClosingWords?.();
        } else {
          onGoToNext?.();
        }
        break;
      case PHASES.REVIEW:
        if (externalReviewQuestion >= (analysisResult?.final_questions.length || 0) - 1) {
          onStartClosingWords?.();
        } else {
          onNextReviewQuestion?.();
        }
        break;
      case PHASES.CONCLUSION: onFinishStudy?.(); break;
      default: break;
    }
  };

  const getSmartButtonText = () => {
    if (studyPhase === 'initial') return "Iniciar Estudio";
    switch (studyPhase) {
      case PHASES.INTRO: return "Pasar al Párrafo 1";
      case PHASES.PARAGRAPHS:
        if (currentParagraphIndex >= (analysisResult?.paragraphs.length || 0) - 1) {
          return analysisResult?.final_questions?.length > 0 ? "Ir a Repaso" : "Ir a Conclusión";
        }
        return "Siguiente Párrafo";
      case PHASES.REVIEW:
        return externalReviewQuestion >= (analysisResult?.final_questions.length || 0) - 1 ? "Ir a Conclusión" : "Siguiente Pregunta";
      case PHASES.CONCLUSION: return "Finalizar Estudio";
      default: return "Siguiente";
    }
  };

  const handleAddCommentClick = () => {
    if (studyPhase === PHASES.PARAGRAPHS) onAddComment(currentParagraphIndex);
    else if (studyPhase === PHASES.REVIEW) onAddComment(externalReviewQuestion);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-800 text-white flex flex-col p-4 md:p-6 landscape:py-2 landscape:px-4">
        {/* Top Bar */}
        <div className="flex justify-end items-start">
          <Button onClick={onExit} variant="ghost" className="text-zinc-400 hover:text-white absolute top-4 right-4 md:top-6 md:right-6">
            <X className="w-8 h-8" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto py-4">

              {/* Time Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
                <div className="text-center">
                  <p className="text-sm md:text-base font-semibold text-zinc-400">Hora Actual</p>
                  <p className="text-3xl md:text-5xl landscape:text-3xl font-bold text-white">{formatClockTime(currentTime)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm md:text-base font-semibold text-cyan-400">Hora de Fin</p>
                  <p className="text-3xl md:text-5xl landscape:text-3xl font-bold text-cyan-400" style={{ fontFamily: "'Orbitron', sans-serif" }}>{endTime ? formatClockTime(endTime) : "--:--"}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm md:text-base font-semibold text-zinc-400">Transcurrido</p>
                  <p className="text-3xl md:text-5xl landscape:text-3xl font-light text-green-400">{formatTime(elapsedTime)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm md:text-base font-semibold text-zinc-400">Restante</p>
                  <p className="text-3xl md:text-5xl landscape:text-3xl font-light text-orange-400">{formatTime(remainingTime)}</p>
                </div>
              </div>

              {/* Comments Display */}
              {studyPhase !== 'initial' && (
                  <div className="text-center bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600 rounded-2xl p-3 landscape:p-2 mb-4 shadow-lg">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">PARTICIPACIONES</p>
                    <p className="text-4xl md:text-5xl landscape:text-3xl font-black text-orange-500 mt-0">{totalComments}</p>
                  </div>
              )}

              <div className={`w-full max-w-lg rounded-2xl flex flex-col items-center justify-center transition-colors duration-500 py-20 px-6 landscape:py-4 landscape:px-2 shadow-2xl ${colorClass}`}>
                <p className="text-white text-2xl md:text-3xl landscape:text-xl font-bold tracking-widest">{indicatorText}</p>
                <p className="text-white text-6xl md:text-8xl landscape:text-6xl font-light" style={{ fontFamily: 'system-ui' }}>{formatTime(phaseElapsedTime)}</p>
                <p className="text-white/70 text-2xl md:text-3xl landscape:text-xl font-light">/ {formatTime(Math.round(estimatedTime))}</p>
              </div>
              <div className="text-center mt-4 landscape:mt-2">
                <p className="text-2xl md:text-3xl landscape:text-xl font-black uppercase tracking-wider">{phaseInfo.title}</p>
                <p className="text-lg md:text-xl landscape:text-base text-zinc-400 mt-1">{phaseInfo.subtitle}</p>

                {/* Paragraph Content Badges */}
                {studyPhase === PHASES.PARAGRAPHS && (
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 landscape:mt-2">
                      {hasImageContent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-900/70 text-purple-200 border border-purple-700">
                      <Image className="w-3.5 h-3.5" />
                      Contiene imagen
                    </span>
                      )}
                      {hasScriptureContent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-900/70 text-blue-200 border border-blue-700">
                      <BookOpen className="w-3.5 h-3.5" />
                      Texto para leer
                    </span>
                      )}
                      {hasNoteContent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-900/70 text-amber-200 border border-amber-700">
                      <MessageCircleQuestion className="w-3.5 h-3.5" />
                      Nota de estudio
                    </span>
                      )}
                      {uniqueHighlightContents?.map((highlightText, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-900/70 text-cyan-200 border border-cyan-700">
                      <Star className="w-3.5 h-3.5" />
                            {highlightText}
                    </span>
                      ))}
                    </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col items-center gap-6 mt-8">
                {studyPhase !== 'initial' && (
                    <Button
                        onClick={handleAddCommentClick}
                        className="bg-orange-500 hover:bg-orange-600 text-white rounded-full w-20 h-20 landscape:w-16 landscape:h-16 flex items-center justify-center shadow-lg transition-all active:scale-95 p-2"
                    >
                      <Hand className="w-full h-full" fill="white" />
                    </Button>
                )}
                <Button
                    onClick={handleSmartButton}
                    size="lg"
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full px-10 py-5 landscape:py-4 text-xl font-bold tracking-wider uppercase h-auto transition-all active:scale-95 shadow-lg shadow-blue-500/30 flex items-center gap-4"
                >
                  <span>{getSmartButtonText()}</span>
                  <ArrowRight className="w-7 h-7" />
                </Button>
              </div>

          {/* Bottom Bar (Fixed at the bottom of the modal) */}
          <div className="flex-shrink-0 pt-4">
            <div className="h-12 landscape:h-10 flex items-center justify-center">
              {studyPhase !== 'initial' && (
                  <span className="text-zinc-500 text-xs">Presiona 'Esc' para salir</span>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
