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
}) {
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Phase elapsed timer
  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => setPhaseElapsed((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Reset phase timer when phase or paragraph/question changes
  useEffect(() => {
    setPhaseElapsed(0);
  }, [studyPhase, currentParagraphIndex, externalReviewQuestion]);

  const { phaseInfo, estimatedTime } = useMemo(() => {
    let info = { title: "Esperando para iniciar", icon: Play, subtitle: "Presiona Iniciar Estudio", estimated: 0 };
    if (studyPhase !== 'initial') {
      switch (studyPhase) {
        case PHASES.INTRO:
          info = { title: "Introducción", icon: Mic, subtitle: "Presentando el tema", estimated: introductionTime * scaleFactor };
          break;
        case PHASES.PARAGRAPHS:
          const paragraph = analysisResult?.paragraphs[currentParagraphIndex];
          info = { title: `Párrafo ${paragraph?.number || ''}`, icon: BookOpen, subtitle: `de ${analysisResult?.total_paragraphs || 0} párrafos`, estimated: (paragraph?.total_time_seconds || 0) * scaleFactor };
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
  }, [studyPhase, currentParagraphIndex, externalReviewQuestion, analysisResult, introductionTime, conclusionTime, scaleFactor]);

  const { colorClass, indicatorText } = useMemo(() => {
    if (!isTimerRunning || estimatedTime === 0) return { colorClass: "bg-gray-600", indicatorText: "EN PAUSA" };
    const ratio = phaseElapsed / estimatedTime;
    if (ratio <= 1) return { colorClass: "bg-green-600", indicatorText: "A TIEMPO" };
    if (ratio <= 1.3) return { colorClass: "bg-orange-500", indicatorText: "MODERAR" };
    return { colorClass: "bg-red-600", indicatorText: "ACELERAR" };
  }, [phaseElapsed, estimatedTime, isTimerRunning]);

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
    <div className="fixed inset-0 z-[9999] bg-slate-900 text-white flex flex-col p-4 md:p-6">
      {/* Top Bar */}
      <div className="flex justify-between items-start mb-4">
        {/* Time Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="text-left">
            <p className="text-sm md:text-base font-semibold text-slate-400">Hora Actual</p>
            <p className="text-3xl md:text-5xl font-bold text-white">{formatClockTime(currentTime)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm md:text-base font-semibold text-cyan-400">Hora de Fin</p>
            <p className="text-3xl md:text-5xl font-bold text-cyan-400" style={{ fontFamily: "'Orbitron', sans-serif" }}>{endTime ? formatClockTime(endTime) : "--:--"}</p>
          </div>
          <div className="text-left">
            <p className="text-sm md:text-base font-semibold text-slate-400">Transcurrido</p>
            <p className="text-3xl md:text-5xl font-light text-green-400">{formatTime(elapsedTime)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm md:text-base font-semibold text-slate-400">Restante</p>
            <p className="text-3xl md:text-5xl font-light text-orange-400">{formatTime(remainingTime)}</p>
          </div>
        </div>
        {/* Comments Display */}
        <div className="text-center bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <p className="text-sm md:text-base font-semibold text-slate-400">Participaciones</p>
          <div className="flex items-center justify-center gap-2">
            <MessageSquarePlus className="w-8 h-8 text-blue-400" />
            <p className="text-5xl font-extrabold text-white">{totalComments}</p>
          </div>
        </div>
      </div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className={`w-full max-w-2xl rounded-2xl flex flex-col items-center justify-center transition-colors duration-500 p-6 shadow-2xl ${colorClass}`}>
          <p className="text-white text-2xl md:text-3xl font-bold tracking-widest">{indicatorText}</p>
          <p className="text-white text-6xl md:text-8xl font-light" style={{ fontFamily: 'system-ui' }}>{formatTime(phaseElapsed)}</p>
          <p className="text-white/70 text-2xl md:text-3xl font-light">/ {formatTime(Math.round(estimatedTime))}</p>
        </div>
        <div className="text-center mt-4">
          <p className="text-2xl md:text-3xl font-bold">{phaseInfo.title}</p>
          <p className="text-lg md:text-xl text-slate-400">{phaseInfo.subtitle}</p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-stretch gap-4">
          <Button
            onClick={handleSmartButton}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 py-10 text-xl h-auto"
          >
            {studyPhase === 'initial' ? <Play className="w-6 h-6 mr-3" /> : <ArrowRight className="w-6 h-6 mr-3" />}
            {getSmartButtonText()}
          </Button>
          {studyPhase !== 'initial' && (
            <Button
              onClick={handleAddCommentClick}
              variant="outline"
              size="lg"
              className="rounded-2xl px-6 py-10 text-xl h-auto border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
            >
              <MessageSquarePlus className="w-6 h-6 mr-3" />
              Participación
            </Button>
          )}
        </div>
        <div className="h-12 flex items-center"> {/* Spacer to prevent layout shift */}
          {studyPhase !== 'initial' && (
            <Button onClick={onExit} variant="ghost" className="text-slate-400 hover:text-white">
              <X className="w-5 h-5 mr-2" />
              Salir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
