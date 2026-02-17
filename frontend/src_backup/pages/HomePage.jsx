import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { 
  Timer,
  Download,
  FileImage,
  File,
  FileText,
  Maximize,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Check,
  Pencil,
  X,
  Moon,
  Sun,
  Palette,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import PresentationMode from "@/components/PresentationMode";

// Import refactored components
import { UploadZone } from "@/components/UploadZone";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { TimerDisplay } from "@/components/TimerDisplay";
import { CountdownTimer } from "@/components/CountdownTimer";
import { QuickStats } from "@/components/QuickStats";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ParagraphCard } from "@/components/ParagraphCard";
import { FinalQuestionsSection } from "@/components/FinalQuestionsSection";
import { ParagraphStatsPanel } from "@/components/ParagraphStatsPanel";
import { IntroductionWordsSection } from "@/components/IntroductionWordsSection";
import { DurationAdjuster } from "@/components/DurationAdjuster";

// Import hooks
import { useLocalStorage, useLocalStorageString } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import { useScheduleCalculator } from "@/hooks/useScheduleCalculator";

// Import utils
import { addSecondsToDate } from "@/utils/timeFormatters";
import { darkThemes, defaultDarkTheme } from "@/utils/darkThemes";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HomePage() {
  // Core state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [remainingTime, setRemainingTime] = useState(60 * 60); // Will be updated when totalDuration changes
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [manualEndTime, setManualEndTime] = useState(null); // For manual end time override
  
  // Refs
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const exportRef = useRef(null);
  
  // Notification state
  const [notificationPlayed, setNotificationPlayed] = useState({
    fiveMin: false,
    oneMin: false,
    now: false
  });
  
  // Settings with localStorage persistence
  const [soundEnabled, setSoundEnabled] = useLocalStorage('pdfTimer_soundEnabled', true);
  const [vibrationEnabled, setVibrationEnabled] = useLocalStorage('pdfTimer_vibrationEnabled', true);
  const [alertTimes, setAlertTimes] = useLocalStorage('pdfTimer_alertTimes', { firstAlert: 0, secondAlert: 0 });
  const [presentationTheme, setPresentationTheme] = useLocalStorageString('pdfTimer_presentationTheme', 'dark');
  const [overtimeAlertEnabled, setOvertimeAlertEnabled] = useLocalStorage('pdfTimer_overtimeAlert', true);
  const [darkMode, setDarkMode] = useLocalStorage('pdfTimer_darkMode', false);
  const [darkTheme, setDarkTheme] = useLocalStorageString('pdfTimer_darkTheme', defaultDarkTheme);
  
  // Get current theme config
  const currentTheme = darkMode ? (darkThemes[darkTheme] || darkThemes.zinc) : null;
  
  // Configurable reading settings
  const [readingSpeed, setReadingSpeed] = useLocalStorage('pdfTimer_readingSpeed', 180);
  const [answerTime, setAnswerTime] = useLocalStorage('pdfTimer_answerTime', 35);
  const [totalDuration, setTotalDuration] = useLocalStorage('pdfTimer_totalDuration', 60);
  
  // Calculate total seconds from duration in minutes
  const totalDurationSeconds = totalDuration * 60;
  
  // Presentation mode
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  
  // Show/hide paragraph content globally
  const [showAllParagraphContent, setShowAllParagraphContent] = useState(false);
  
  // Manual paragraph navigation
  const [currentManualParagraph, setCurrentManualParagraph] = useState(0);
  const [paragraphStartTimes, setParagraphStartTimes] = useState({});
  const [lowTimeAlertShown, setLowTimeAlertShown] = useState(false);
  
  // Statistics tracking - stores actual time spent on each paragraph
  const [paragraphStats, setParagraphStats] = useState({});
  const [paragraphStartTime, setParagraphStartTime] = useState(null);
  
  // Review questions navigation
  const [isInReviewMode, setIsInReviewMode] = useState(false);
  const [currentReviewQuestion, setCurrentReviewQuestion] = useState(0);
  const [reviewQuestionStartTime, setReviewQuestionStartTime] = useState(null);
  
  // Introduction words section
  const [isInIntroductionMode, setIsInIntroductionMode] = useState(false);
  const [introductionStartTime, setIntroductionStartTime] = useState(null);
  const [introductionDuration, setIntroductionDuration] = useLocalStorage('pdfTimer_introductionDuration', 60); // 1 minute default
  const [conclusionDuration, setConclusionDuration] = useLocalStorage('pdfTimer_conclusionDuration', 60); // 1 minute default
  
  // Closing words section
  const [isInClosingWordsMode, setIsInClosingWordsMode] = useState(false);
  const [closingWordsStartTime, setClosingWordsStartTime] = useState(null);
  const [closingWordsDuration, setClosingWordsDuration] = useLocalStorage('pdfTimer_closingWordsDuration', 60); // 1 minute default
  
  // Presentation mode phase state (persists when exiting/entering presentation mode)
  const [presentationPhase, setPresentationPhase] = useState('intro');
  const [presentationReviewQuestion, setPresentationReviewQuestion] = useState(0);
  
  // State for editing end time on initial screen (before PDF upload)
  const [isEditingInitialEndTime, setIsEditingInitialEndTime] = useState(false);
  const [initialEditHours, setInitialEditHours] = useState('');
  const [initialEditMinutes, setInitialEditMinutes] = useState('');


  // Custom hooks
  const { playNotificationSound, triggerVibration } = useNotifications(soundEnabled, vibrationEnabled);
  const {
    getAdjustedFinalQuestionsTime,
    getAdjustedFinalQuestionTime,
    getAdjustedParagraphTimes,
    getFinalQuestionsTimeSeconds,
    getFinalQuestionsTime,
    getScaleFactor,
    getScaledIntroductionTime,
    getScaledConclusionTime,
    originalTotalTime,
  } = useScheduleCalculator(
    analysisResult, 
    startTime, 
    remainingTime, 
    currentManualParagraph,
    totalDurationSeconds,
    introductionDuration,
    conclusionDuration
  );

  // Group paragraphs that belong together based on "grouped_with" field
  const groupedParagraphs = React.useMemo(() => {
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
            firstParagraph: groupParagraphs[0],
            indices: groupParagraphs.map(gp => paragraphs.findIndex(p => p.number === gp.number))
          });
        }
      } else {
        // Single paragraph
        processedIndices.add(index);
        groups.push({
          type: 'single',
          paragraphs: [para],
          firstParagraph: para,
          indices: [index]
        });
      }
    });
    
    return groups;
  }, [analysisResult?.paragraphs]);

  // Presentation mode functions
  const enterPresentationMode = useCallback(() => {
    // Sync presentation phase with current HomePage state before entering
    let newPhase = presentationPhase;
    if (isInIntroductionMode) {
      newPhase = 'intro';
    } else if (isInReviewMode) {
      newPhase = 'review';
    } else if (isInClosingWordsMode) {
      newPhase = 'conclusion';
    } else if (isTimerRunning && currentManualParagraph >= 0) {
      // Timer is running and we're on a paragraph
      newPhase = 'paragraphs';
    } else if (!isTimerRunning && currentManualParagraph > 0) {
      // Timer stopped but we've made progress - stay on paragraphs
      newPhase = 'paragraphs';
    }
    
    // Update states synchronously - phase first, then show modal
    setPresentationPhase(newPhase);
    if (isInReviewMode) {
      setPresentationReviewQuestion(currentReviewQuestion);
    }
    
    // Use setTimeout to ensure state is updated before showing modal
    setTimeout(() => {
      setIsPresentationMode(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('Fullscreen not supported:', err);
        });
      }
    }, 0);
  }, [isInIntroductionMode, isInReviewMode, isInClosingWordsMode, isTimerRunning, currentManualParagraph, currentReviewQuestion, presentationPhase]);

  const exitPresentationMode = useCallback(() => {
    setIsPresentationMode(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(err => {
        console.log('Exit fullscreen error:', err);
      });
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isPresentationMode]);

  // Paragraph navigation
  const goToNextParagraph = useCallback(() => {
    if (!analysisResult || currentManualParagraph >= analysisResult.paragraphs.length - 1) return;
    
    // Save actual time spent on current paragraph
    if (paragraphStartTime) {
      const actualTimeSpent = Math.round((Date.now() - paragraphStartTime) / 1000);
      const currentParagraph = analysisResult.paragraphs[currentManualParagraph];
      const estimatedTime = currentParagraph.total_time_seconds;
      
      setParagraphStats(prev => ({
        ...prev,
        [currentManualParagraph]: {
          paragraphNumber: currentParagraph.number,
          estimatedTime: Math.round(estimatedTime),
          actualTime: actualTimeSpent,
          difference: actualTimeSpent - Math.round(estimatedTime),
          wordCount: currentParagraph.word_count,
          questionsCount: currentParagraph.questions.length
        }
      }));
    }
    
    const nextIndex = currentManualParagraph + 1;
    setCurrentManualParagraph(nextIndex);
    setParagraphStartTime(Date.now()); // Start timing the next paragraph
    const now = new Date();
    setParagraphStartTimes(prev => ({ ...prev, [nextIndex]: now }));
    toast.success(`Avanzando al Párrafo ${nextIndex + 1}`);
  }, [currentManualParagraph, analysisResult, paragraphStartTime]);

  const goToPreviousParagraph = useCallback(() => {
    if (currentManualParagraph <= 0) return;
    const prevIndex = currentManualParagraph - 1;
    setCurrentManualParagraph(prevIndex);
    toast.info(`Volviendo al Párrafo ${prevIndex + 1}`);
  }, [currentManualParagraph]);

  // Check for low question time alert
  useEffect(() => {
    if (!isTimerRunning || !analysisResult) return;
    
    const adjustedTimes = getAdjustedFinalQuestionsTime();
    if (!adjustedTimes || !adjustedTimes.perQuestion) return;
    
    const timePerQuestion = adjustedTimes.perQuestion;
    
    if (timePerQuestion < 20 && !lowTimeAlertShown) {
      setLowTimeAlertShown(true);
      playNotificationSound('urgent');
      triggerVibration([300, 100, 300, 100, 300]);
      toast.error(`⚠️ ¡Alerta! Solo ${Math.round(timePerQuestion)} seg por pregunta. ¡Acelera la lectura!`, { 
        duration: 10000,
        important: true
      });
    }
    
    if (timePerQuestion >= 25 && lowTimeAlertShown) {
      setLowTimeAlertShown(false);
    }
  }, [isTimerRunning, analysisResult, getAdjustedFinalQuestionsTime, lowTimeAlertShown, playNotificationSound, triggerVibration]);

  // Check for notification triggers
  useEffect(() => {
    if (!isTimerRunning || !analysisResult) return;
    
    const finalQuestionsSeconds = getFinalQuestionsTimeSeconds();
    if (finalQuestionsSeconds <= 0) return;
    
    const timeUntilFinalQuestions = finalQuestionsSeconds - elapsedTime;
    
    // First alert - only if value > 0
    if (alertTimes.firstAlert > 0) {
      const firstAlertSeconds = alertTimes.firstAlert * 60;
      if (timeUntilFinalQuestions <= firstAlertSeconds && timeUntilFinalQuestions > firstAlertSeconds - 5 && !notificationPlayed.fiveMin) {
        playNotificationSound('warning');
        triggerVibration([200, 100, 200]);
        setNotificationPlayed(prev => ({ ...prev, fiveMin: true }));
        toast.warning(`⏰ ${alertTimes.firstAlert} minuto${alertTimes.firstAlert > 1 ? 's' : ''} para las preguntas de repaso`, { duration: 5000 });
      }
    }
    
    // Second alert - only if value > 0
    if (alertTimes.secondAlert > 0) {
      const secondAlertSeconds = alertTimes.secondAlert * 60;
      if (timeUntilFinalQuestions <= secondAlertSeconds && timeUntilFinalQuestions > secondAlertSeconds - 5 && !notificationPlayed.oneMin) {
        playNotificationSound('urgent');
        triggerVibration([200, 100, 200, 100, 200]);
        setNotificationPlayed(prev => ({ ...prev, oneMin: true }));
        toast.warning(`⚠️ ${alertTimes.secondAlert} minuto${alertTimes.secondAlert > 1 ? 's' : ''} para las preguntas de repaso`, { duration: 5000 });
      }
    }
    
    if (timeUntilFinalQuestions <= 0 && timeUntilFinalQuestions > -5 && !notificationPlayed.now) {
      playNotificationSound('final');
      triggerVibration([500, 200, 500, 200, 500]);
      setNotificationPlayed(prev => ({ ...prev, now: true }));
      toast.success("🎯 ¡Es hora de las preguntas de repaso!", { duration: 8000 });
    }
  }, [elapsedTime, isTimerRunning, analysisResult, notificationPlayed, playNotificationSound, getFinalQuestionsTimeSeconds, alertTimes, triggerVibration]);

  // Initialize remaining time when analysis is complete or duration changes
  useEffect(() => {
    if (analysisResult) {
      setRemainingTime(totalDurationSeconds);
    }
  }, [analysisResult, totalDurationSeconds]);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        setRemainingTime(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  // File upload handler
  const handleFileUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Por favor, selecciona un archivo PDF válido");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${API}/analyze-pdf?wpm=${readingSpeed}&answer_time_seconds=${answerTime}`, 
        formData, 
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      
      setAnalysisResult(response.data);
      setElapsedTime(0);
      setIsTimerRunning(false);
      setStartTime(null);
      setEndTime(null);
      setCurrentManualParagraph(0);
      toast.success("PDF analizado correctamente");
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast.error(error.response?.data?.detail || "Error al procesar el PDF");
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files[0]);
  };

  // Timer controls
  const toggleTimer = () => {
    if (!isTimerRunning) {
      // If this is the first time starting, use startIntroductionMode to begin with introduction
      if (!startTime) {
        startIntroductionMode();
        return; // startIntroductionMode already sets isTimerRunning to true
      }
    }
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setElapsedTime(0);
    setRemainingTime(totalDurationSeconds);
    setStartTime(null);
    setEndTime(null);
    // Don't reset manualEndTime so user keeps their preference
    setNotificationPlayed({ fiveMin: false, oneMin: false, now: false });
    setCurrentManualParagraph(0);
    setParagraphStartTimes({});
    setLowTimeAlertShown(false);
    setParagraphStats({});
    setParagraphStartTime(null);
    setIsInReviewMode(false);
    setCurrentReviewQuestion(0);
    setReviewQuestionStartTime(null);
    setIsInIntroductionMode(false);
    setIntroductionStartTime(null);
    setIsInClosingWordsMode(false);
    setClosingWordsStartTime(null);
  };

  const resetAll = () => {
    setAnalysisResult(null);
    setManualEndTime(null); // Reset manual end time when starting fresh
    resetTimer();
  };

  // Start introduction mode and main timer
  const startIntroductionMode = useCallback(() => {
    setIsInIntroductionMode(true);
    setIntroductionStartTime(Date.now());
    setPresentationPhase('intro'); // Sync presentation phase
    
    // Start main timer
    const now = new Date();
    setStartTime(now);
    if (manualEndTime) {
      setEndTime(manualEndTime);
      const diffSeconds = Math.floor((manualEndTime.getTime() - now.getTime()) / 1000);
      setRemainingTime(Math.max(0, diffSeconds));
    } else {
      setEndTime(addSecondsToDate(now, totalDurationSeconds));
    }
    setIsTimerRunning(true);
    
    toast.success("Iniciando Palabras de Introducción");
  }, [manualEndTime, totalDurationSeconds]);

  // Move to first paragraph after introduction
  const goToFirstParagraph = useCallback(() => {
    setIsInIntroductionMode(false);
    setCurrentManualParagraph(0);
    setParagraphStartTime(Date.now());
    setPresentationPhase('paragraphs'); // Sync presentation phase
    toast.success("Pasando al Párrafo 1");
  }, []);

  // Start review questions mode
  const startReviewMode = useCallback(() => {
    setIsInReviewMode(true);
    setCurrentReviewQuestion(0);
    setReviewQuestionStartTime(Date.now());
    setPresentationPhase('review'); // Sync presentation phase
    setPresentationReviewQuestion(0);
    toast.success("Iniciando Preguntas de Repaso");
  }, []);

  // Navigate to next review question
  const goToNextReviewQuestion = useCallback(() => {
    if (!analysisResult?.final_questions) return;
    
    const nextQuestion = currentReviewQuestion + 1;
    if (nextQuestion < analysisResult.final_questions.length) {
      setCurrentReviewQuestion(nextQuestion);
      setReviewQuestionStartTime(Date.now());
      setPresentationReviewQuestion(nextQuestion); // Sync presentation review question
      toast.success(`Pregunta de repaso ${nextQuestion + 1}`);
    }
  }, [currentReviewQuestion, analysisResult]);

  // Start closing words mode
  const startClosingWordsMode = useCallback(() => {
    setIsInClosingWordsMode(true);
    setClosingWordsStartTime(Date.now());
    setPresentationPhase('conclusion'); // Sync presentation phase
    toast.success("Iniciando Palabras de Conclusión");
  }, []);

  // Finish study
  const finishStudy = useCallback(() => {
    setIsTimerRunning(false);
    setIsInClosingWordsMode(false);
    setIsInReviewMode(false);
    setPresentationPhase('finished'); // Sync presentation phase
    toast.success("¡Estudio finalizado! 🎉");
  }, []);

  // Start from specific paragraph
  const startFromParagraph = useCallback((paragraphIndex) => {
    let cumulativeTime = 0;
    for (let i = 0; i < paragraphIndex; i++) {
      cumulativeTime += analysisResult.paragraphs[i].total_time_seconds;
    }
    
    setElapsedTime(Math.floor(cumulativeTime));
    setRemainingTime(totalDurationSeconds - Math.floor(cumulativeTime));
    
    const now = new Date();
    const virtualStartTime = new Date(now.getTime() - cumulativeTime * 1000);
    setStartTime(virtualStartTime);
    setEndTime(addSecondsToDate(virtualStartTime, totalDurationSeconds));
    setCurrentManualParagraph(paragraphIndex);
    setIsTimerRunning(true);
    setNotificationPlayed({ fiveMin: false, oneMin: false, now: false });
    setParagraphStartTime(Date.now()); // Start timing this paragraph
    
    toast.success(`Iniciando desde Párrafo ${paragraphIndex + 1}`);
  }, [analysisResult, totalDurationSeconds]);

  // Export functions
  const exportToImage = async () => {
    if (!exportRef.current) return;
    toast.loading("Generando imagen...");
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const link = document.createElement('a');
      link.download = `cronograma-${analysisResult.filename.replace('.pdf', '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.dismiss();
      toast.success("Imagen exportada correctamente");
    } catch (error) {
      toast.dismiss();
      toast.error("Error al exportar imagen");
    }
  };

  const exportToPDF = async () => {
    if (!exportRef.current) return;
    toast.loading("Generando PDF...");
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`cronograma-${analysisResult.filename.replace('.pdf', '')}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado correctamente");
    } catch (error) {
      toast.dismiss();
      toast.error("Error al exportar PDF");
    }
  };

  // Calculate progress
  const progressPercentage = analysisResult ? Math.min(100, (elapsedTime / totalDurationSeconds) * 100) : 0;
  const adjustedFinalTimes = getAdjustedFinalQuestionsTime();

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? currentTheme?.bg || 'bg-zinc-900' : 'bg-stone-50'}`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-50 shadow-sm backdrop-blur-md transition-colors duration-300 ${
        darkMode 
          ? `${currentTheme?.border || 'border-zinc-700'} ${currentTheme?.panel || 'bg-zinc-800'}/90` 
          : 'border-slate-200 bg-white/90'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <img 
                src="/logo-icon.png" 
                alt="Atalaya Timer" 
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl shadow-lg"
              />
              <div>
                <h1 className="font-heading font-bold text-base sm:text-xl text-orange-500" data-testid="app-title">
                  ATALAYA DE ESTUDIO
                </h1>
                <p className={`text-xs font-semibold tracking-wide hidden sm:block ${darkMode ? currentTheme?.textMuted || 'text-zinc-400' : 'text-slate-700'}`}>Calculadora de Tiempo</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Dark Mode Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full w-9 h-9 sm:w-10 sm:h-10 ${
                      darkMode 
                        ? 'text-yellow-400 hover:bg-zinc-700' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title={darkMode ? 'Opciones de modo oscuro' : 'Activar modo oscuro'}
                    data-testid="dark-mode-toggle"
                  >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`rounded-xl min-w-[200px] ${darkMode ? 'bg-zinc-800 border-zinc-700' : ''}`}>
                  {darkMode ? (
                    <>
                      <DropdownMenuItem 
                        onClick={() => setDarkMode(false)} 
                        className={`cursor-pointer ${darkMode ? 'hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}
                      >
                        <Sun className="w-4 h-4 mr-2 text-yellow-500" />
                        <span className={darkMode ? 'text-zinc-200' : ''}>Modo Claro</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className={darkMode ? 'bg-zinc-700' : ''} />
                      <DropdownMenuLabel className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                        <Palette className="w-3 h-3 inline mr-1" />
                        Variante Oscura
                      </DropdownMenuLabel>
                      {Object.entries(darkThemes).map(([key, theme]) => (
                        <DropdownMenuItem 
                          key={key}
                          onClick={() => setDarkTheme(key)}
                          className={`cursor-pointer ${darkMode ? 'hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div 
                              className="w-4 h-4 rounded-full border-2"
                              style={{ 
                                backgroundColor: theme.colors.panel,
                                borderColor: darkTheme === key ? '#f97316' : theme.colors.border
                              }}
                            />
                            <div className="flex-1">
                              <span className={`text-sm ${darkMode ? 'text-zinc-200' : ''}`}>{theme.name}</span>
                              <span className={`text-xs block ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{theme.description}</span>
                            </div>
                            {darkTheme === key && <Check className="w-4 h-4 text-orange-500" />}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : (
                    <DropdownMenuItem 
                      onClick={() => setDarkMode(true)} 
                      className="cursor-pointer"
                    >
                      <Moon className="w-4 h-4 mr-2 text-slate-600" />
                      Activar Modo Oscuro
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {analysisResult && (
                <>
                <Button 
                  variant="outline" 
                  onClick={enterPresentationMode} 
                  className={`rounded-full px-2 sm:px-5 py-1.5 sm:py-2 border-2 font-medium transition-all text-xs sm:text-sm ${
                    darkMode
                      ? 'border-zinc-500 text-zinc-100 hover:border-orange-400 hover:text-orange-400 hover:bg-orange-500/10'
                      : 'border-slate-300 text-slate-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                  data-testid="presentation-mode-btn"
                >
                  <Maximize className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Presentación</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={`rounded-full px-2 sm:px-5 py-1.5 sm:py-2 border-2 font-medium text-xs sm:text-sm ${
                        darkMode
                          ? 'border-zinc-500 text-zinc-100 hover:border-zinc-400 hover:bg-zinc-700'
                          : 'border-slate-300 text-slate-700 hover:border-slate-400'
                      }`}
                      data-testid="export-btn"
                    >
                      <Download className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Exportar</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={`rounded-xl ${darkMode ? 'bg-zinc-800 border-zinc-600' : ''}`}>
                    <DropdownMenuItem onClick={exportToImage} data-testid="export-image-btn" className={`cursor-pointer ${darkMode ? 'text-zinc-100 hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}>
                      <FileImage className="w-4 h-4 mr-2" />
                      Exportar como Imagen (PNG)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPDF} data-testid="export-pdf-btn" className={`cursor-pointer ${darkMode ? 'text-zinc-100 hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}>
                      <File className="w-4 h-4 mr-2" />
                      Exportar como PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button 
                  variant="ghost" 
                  onClick={resetAll} 
                  className={`rounded-full px-2 sm:px-4 py-1.5 sm:py-2 font-medium text-xs sm:text-sm ${
                    darkMode
                      ? 'text-zinc-200 hover:text-zinc-50 hover:bg-zinc-700'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                  data-testid="new-analysis-btn"
                >
                  <RotateCcw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nuevo</span>
                </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {!analysisResult ? (
          <div className="space-y-4 sm:space-y-8">
            {/* Time Schedule Panel - Before PDF Upload */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl border border-slate-700/50">
              
              {/* Main Time Display Grid */}
              <div className="grid grid-cols-3 gap-4 sm:gap-8 items-center">
                
                {/* Start Time - Bright Green */}
                <div className="text-center">
                  <div className="inline-block bg-emerald-500/20 rounded-xl px-3 py-1 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-widest">Inicio</span>
                  </div>
                  <p 
                    className="text-2xl sm:text-4xl md:text-5xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                    style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
                  >
                    {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
                
                {/* Duration - Center */}
                <div className="flex flex-col items-center">
                  <div className="inline-block bg-orange-500/20 rounded-xl px-3 py-1 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-orange-400 uppercase tracking-widest">Duración</span>
                  </div>
                  <span className={`text-2xl sm:text-4xl md:text-5xl font-black drop-shadow-[0_0_10px_rgba(251,146,60,0.5)] ${manualEndTime ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'text-orange-400'}`}>
                    {manualEndTime 
                      ? Math.max(0, Math.round((manualEndTime.getTime() - new Date().getTime()) / 60000))
                      : totalDuration}
                    <span className="text-lg sm:text-2xl ml-1">min</span>
                  </span>
                </div>
                
                {/* End Time - Editable - Bright Yellow/Amber */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-yellow-500/20 rounded-xl px-3 py-1 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-yellow-400 uppercase tracking-widest">
                      Fin {manualEndTime && <span className="text-[10px] opacity-70">(manual)</span>}
                    </span>
                    {!isEditingInitialEndTime && (
                      <button
                        onClick={() => {
                          const timeToEdit = manualEndTime || new Date(Date.now() + totalDuration * 60 * 1000);
                          setInitialEditHours(timeToEdit.getHours().toString().padStart(2, '0'));
                          setInitialEditMinutes(timeToEdit.getMinutes().toString().padStart(2, '0'));
                          setIsEditingInitialEndTime(true);
                        }}
                        className="p-1.5 rounded-lg bg-yellow-500/30 hover:bg-yellow-500/50 transition-all hover:scale-110"
                        title="Editar hora de fin"
                      >
                        <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300" />
                      </button>
                    )}
                  </div>
                  
                  {isEditingInitialEndTime ? (
                    <div className="flex flex-col items-center gap-3">
                      {/* Time inputs row */}
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="text"
                          value={initialEditHours}
                          onChange={(e) => setInitialEditHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          className="w-14 sm:w-20 h-12 sm:h-16 text-center bg-slate-700/80 border-2 border-yellow-500/50 rounded-xl text-yellow-300 text-2xl sm:text-4xl font-black focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                          placeholder="HH"
                          maxLength={2}
                          autoFocus
                        />
                        <span className="text-yellow-400 text-3xl sm:text-4xl font-black animate-pulse">:</span>
                        <input
                          type="text"
                          value={initialEditMinutes}
                          onChange={(e) => setInitialEditMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          className="w-14 sm:w-20 h-12 sm:h-16 text-center bg-slate-700/80 border-2 border-yellow-500/50 rounded-xl text-yellow-300 text-2xl sm:text-4xl font-black focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                          placeholder="MM"
                          maxLength={2}
                        />
                      </div>
                      {/* Action buttons row */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const hours = parseInt(initialEditHours) || 0;
                            const minutes = parseInt(initialEditMinutes) || 0;
                            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                              const newEndTime = new Date();
                              newEndTime.setHours(hours, minutes, 0, 0);
                              setManualEndTime(newEndTime);
                              setIsEditingInitialEndTime(false);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
                          title="Guardar"
                        >
                          <Check className="w-5 h-5 text-white" />
                          <span className="text-white font-bold text-sm hidden sm:inline">Guardar</span>
                        </button>
                        <button
                          onClick={() => setIsEditingInitialEndTime(false)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 transition-all hover:scale-105"
                          title="Cancelar"
                        >
                          <X className="w-5 h-5 text-white" />
                          <span className="text-white font-bold text-sm hidden sm:inline">Cancelar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p 
                      className="text-2xl sm:text-4xl md:text-5xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] cursor-pointer hover:text-yellow-300 transition-colors"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
                      onClick={() => {
                        const timeToEdit = manualEndTime || new Date(Date.now() + totalDuration * 60 * 1000);
                        setInitialEditHours(timeToEdit.getHours().toString().padStart(2, '0'));
                        setInitialEditMinutes(timeToEdit.getMinutes().toString().padStart(2, '0'));
                        setIsEditingInitialEndTime(true);
                      }}
                      title="Clic para editar"
                    >
                      {manualEndTime 
                        ? manualEndTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : new Date(Date.now() + totalDuration * 60 * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })
                      }
                    </p>
                  )}
                </div>
              </div>
              
              {/* Footer info */}
              <div className="text-center mt-4 sm:mt-6 pt-4 border-t border-slate-700/50">
                {manualEndTime ? (
                  <button
                    onClick={() => setManualEndTime(null)}
                    className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar hora automática
                  </button>
                ) : (
                  <p className="text-slate-400 text-sm">
                    Hora actual + <span className="text-orange-400 font-bold">{totalDuration} min</span> = Hora de fin
                  </p>
                )}
              </div>
            </div>

            <SettingsPanel
              readingSpeed={readingSpeed}
              setReadingSpeed={setReadingSpeed}
              answerTime={answerTime}
              setAnswerTime={setAnswerTime}
              totalDuration={totalDuration}
              setTotalDuration={setTotalDuration}
              introductionDuration={introductionDuration}
              setIntroductionDuration={setIntroductionDuration}
              closingWordsDuration={closingWordsDuration}
              setClosingWordsDuration={setClosingWordsDuration}
              darkMode={darkMode}
            />
            <UploadZone
              onFileSelect={handleFileUpload}
              isDragging={isDragging}
              isLoading={isLoading}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              fileInputRef={fileInputRef}
              readingSpeed={readingSpeed}
              answerTime={answerTime}
              darkMode={darkMode}
            />
          </div>
        ) : (
          <div ref={exportRef} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column - Analysis */}
            <div className="lg:col-span-8 space-y-6">
              <AnalysisSummary 
                analysisResult={analysisResult} 
                darkMode={darkMode} 
                totalDurationMinutes={totalDuration}
                introductionDuration={introductionDuration}
                closingWordsDuration={closingWordsDuration}
              />

              {/* Paragraph Progress Indicator */}
              {isTimerRunning && !isInIntroductionMode && (
                <Card className={`border-2 shadow-md rounded-2xl ${
                  darkMode 
                    ? 'border-green-700 bg-gradient-to-r from-green-950 to-zinc-900' 
                    : 'border-green-200 bg-gradient-to-r from-green-50 to-white'
                }`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg ${
                          darkMode ? 'shadow-green-900/30' : 'shadow-green-200'
                        }`}>
                          <span className="text-white font-bold text-lg">{currentManualParagraph + 1}</span>
                        </div>
                        <div>
                          <p className={`text-base font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            Párrafo {currentManualParagraph + 1} <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>de {analysisResult.total_paragraphs}</span>
                          </p>
                          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Usa los botones para navegar
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          onClick={goToPreviousParagraph} 
                          disabled={currentManualParagraph <= 0} 
                          className={`rounded-full w-12 h-12 border-2 disabled:opacity-40 ${
                            darkMode 
                              ? 'border-zinc-600 hover:border-green-500 hover:bg-green-950' 
                              : 'border-slate-300 hover:border-green-400 hover:bg-green-50'
                          }`}
                          data-testid="prev-paragraph-btn"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <Button 
                          onClick={goToNextParagraph} 
                          disabled={currentManualParagraph >= analysisResult.paragraphs.length - 1} 
                          className={`rounded-full w-12 h-12 bg-green-500 hover:bg-green-600 text-white shadow-lg disabled:opacity-40 ${
                            darkMode ? 'shadow-green-900/30' : 'shadow-green-200'
                          }`}
                          data-testid="next-paragraph-btn"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Adjusted Times Summary */}
                    {adjustedFinalTimes.perQuestion && adjustedFinalTimes.perQuestion !== 35 && (
                      <div className={`mt-4 p-4 rounded-xl border-2 ${
                        adjustedFinalTimes.perQuestion < 20 
                          ? darkMode ? 'bg-orange-950/50 border-orange-800' : 'bg-orange-100 border-orange-300' 
                          : darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${
                              adjustedFinalTimes.perQuestion < 20 
                                ? darkMode ? 'text-orange-400' : 'text-orange-600' 
                                : darkMode ? 'text-slate-400' : 'text-slate-600'
                            }`} />
                            <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tiempo por pregunta:</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono text-xl font-bold ${
                              adjustedFinalTimes.perQuestion < 20 
                                ? darkMode ? 'text-orange-400' : 'text-orange-600' 
                                : darkMode ? 'text-slate-200' : 'text-slate-800'
                            }`}>
                              {Math.round(adjustedFinalTimes.perQuestion)} seg
                            </span>
                            <span className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>(orig: 35s)</span>
                          </div>
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
              )}

              {/* Introduction Words Section */}
              <IntroductionWordsSection
                isActive={isInIntroductionMode}
                isTimerRunning={isTimerRunning}
                estimatedTime={introductionDuration}
                onStartIntroduction={startIntroductionMode}
                onGoToFirstParagraph={goToFirstParagraph}
                hasStarted={startTime !== null}
                overtimeAlertEnabled={overtimeAlertEnabled}
                soundEnabled={soundEnabled}
                vibrationEnabled={vibrationEnabled}
                playNotificationSound={playNotificationSound}
                triggerVibration={triggerVibration}
                darkMode={darkMode}
              />

              {/* Paragraphs List */}
              <div className="space-y-4">
                {/* Header con estilo mejorado */}
                <div className={`rounded-2xl border-2 p-4 ${
                  darkMode 
                    ? 'bg-gradient-to-r from-orange-950/50 to-zinc-900 border-orange-700' 
                    : 'bg-gradient-to-r from-orange-50 to-white border-orange-200'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        darkMode ? 'bg-orange-600' : 'bg-orange-500'
                      }`}>
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className={`font-heading font-bold text-base ${darkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
                          Desglose de párrafos
                        </h3>
                        <p className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {analysisResult.total_paragraphs} párrafos · {analysisResult.total_words} palabras
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllParagraphContent(!showAllParagraphContent)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition-all shadow-sm border-2 ${
                        showAllParagraphContent
                          ? darkMode 
                            ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-500' 
                            : 'bg-orange-500 hover:bg-orange-600 text-white border-orange-400'
                          : darkMode 
                            ? 'bg-green-500 hover:bg-green-600 text-white border-green-400' 
                            : 'bg-green-400 hover:bg-green-500 text-white border-green-300'
                      }`}
                      data-testid="toggle-all-content-btn"
                    >
                      {showAllParagraphContent ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1.5" />
                          Ocultar contenido
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1.5" />
                          Mostrar contenido
                        </>
                      )}
                    </Button>
                  </div>
                  {isTimerRunning && !isInIntroductionMode && (
                    <div className={`flex items-center justify-center gap-2 mt-3 pt-3 border-t ${
                      darkMode ? 'border-orange-800' : 'border-orange-100'
                    }`}>
                      <Button size="sm" variant="outline" onClick={goToPreviousParagraph} disabled={currentManualParagraph <= 0} className={`text-xs rounded-full ${darkMode ? 'border-zinc-600' : ''}`} data-testid="prev-paragraph-btn-2">
                        <ChevronLeft className="w-3 h-3 mr-1" />
                        Anterior
                      </Button>
                      <Badge className={`font-mono px-3 py-1 ${darkMode ? 'bg-orange-700 text-white' : 'bg-orange-100 text-orange-700'}`}>
                        {currentManualParagraph + 1} / {analysisResult.total_paragraphs}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={goToNextParagraph} disabled={currentManualParagraph >= analysisResult.paragraphs.length - 1} className={`text-xs rounded-full ${darkMode ? 'border-zinc-600' : ''}`} data-testid="next-paragraph-btn-2">
                        Siguiente
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  {groupedParagraphs.map((group, groupIndex) => {
                    const firstIndex = group.indices[0];
                    const lastIndex = group.indices[group.indices.length - 1];
                    // Show as current if timer is running and we're on this group
                    const isCurrentGroup = isTimerRunning && !isInIntroductionMode && group.indices.includes(currentManualParagraph);
                    // Show as completed if we've passed this group (regardless of timer state)
                    const isCompletedGroup = !isInIntroductionMode && lastIndex < currentManualParagraph;
                    
                    return (
                      <ParagraphCard
                        key={`group-${group.firstParagraph.number}`}
                        paragraph={group.firstParagraph}
                        groupedParagraphs={group.paragraphs}
                        index={firstIndex}
                        startTime={startTime}
                        paragraphTimes={getAdjustedParagraphTimes(firstIndex)}
                        onStartFromHere={() => startFromParagraph(firstIndex)}
                        isTimerRunning={isTimerRunning && !isInIntroductionMode}
                        isCurrentParagraph={isCurrentGroup}
                        isCompletedParagraph={isCompletedGroup || isInReviewMode}
                        elapsedTime={elapsedTime}
                        onGoToNext={() => {
                          // Skip to the paragraph after the last one in the group
                          if (lastIndex < analysisResult.paragraphs.length - 1) {
                            setCurrentManualParagraph(lastIndex + 1);
                            setParagraphStartTime(Date.now());
                            // Save stats for all paragraphs in group (using scaled time)
                            if (paragraphStartTime) {
                              const actualTimeSpent = Math.round((Date.now() - paragraphStartTime) / 1000);
                              const scaledEstimated = getAdjustedParagraphTimes(firstIndex).adjustedDuration || 
                                group.paragraphs.reduce((sum, p) => sum + p.total_time_seconds, 0);
                              setParagraphStats(prev => ({
                                ...prev,
                                [firstIndex]: {
                                  paragraphNumber: group.paragraphs.map(p => p.number).join(', '),
                                  estimatedTime: Math.round(scaledEstimated),
                                  actualTime: actualTimeSpent,
                                  difference: actualTimeSpent - Math.round(scaledEstimated),
                                  wordCount: group.paragraphs.reduce((sum, p) => sum + p.word_count, 0),
                                  questionsCount: group.paragraphs.reduce((sum, p) => sum + p.questions.length, 0)
                                }
                              }));
                            }
                            toast.success(`Avanzando al Párrafo ${analysisResult.paragraphs[lastIndex + 1].number}`);
                          }
                        }}
                        isLastParagraph={lastIndex === analysisResult.paragraphs.length - 1}
                        adjustedQuestionTime={adjustedFinalTimes.perQuestion}
                        scaleFactor={getScaleFactor()}
                        overtimeAlertEnabled={overtimeAlertEnabled}
                        soundEnabled={soundEnabled}
                        vibrationEnabled={vibrationEnabled}
                        playNotificationSound={playNotificationSound}
                        triggerVibration={triggerVibration}
                        onStartReview={startReviewMode}
                        hasReviewQuestions={analysisResult.final_questions?.length > 0}
                        darkMode={darkMode}
                        showContentGlobal={showAllParagraphContent}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Final Questions Section - After all paragraphs */}
              {analysisResult.final_questions?.length > 0 && (
                <FinalQuestionsSection
                  finalQuestions={analysisResult.final_questions}
                  finalQuestionsTitle={analysisResult.final_questions_title}
                  startTime={startTime}
                  isTimerRunning={isTimerRunning}
                  adjustedTimes={adjustedFinalTimes}
                  getQuestionTime={getAdjustedFinalQuestionTime}
                  originalStartTime={getFinalQuestionsTimeSeconds()}
                  isInReviewMode={isInReviewMode}
                  currentReviewQuestion={currentReviewQuestion}
                  onStartReview={startReviewMode}
                  onNextReviewQuestion={goToNextReviewQuestion}
                  onStartClosingWords={startClosingWordsMode}
                  isInClosingWordsMode={isInClosingWordsMode}
                  closingWordsDuration={closingWordsDuration}
                  onFinishStudy={finishStudy}
                  overtimeAlertEnabled={overtimeAlertEnabled}
                  soundEnabled={soundEnabled}
                  vibrationEnabled={vibrationEnabled}
                  playNotificationSound={playNotificationSound}
                  triggerVibration={triggerVibration}
                  darkMode={darkMode}
                />
              )}
            </div>

            {/* Right Column - Timers */}
            <div className="lg:col-span-4 space-y-6">
              <div className="lg:sticky lg:top-24 space-y-6">
                <TimerDisplay
                  elapsedTime={elapsedTime}
                  isTimerRunning={isTimerRunning}
                  startTime={startTime}
                  endTime={endTime}
                  progressPercentage={progressPercentage}
                  onToggle={toggleTimer}
                  onReset={resetTimer}
                  remainingTime={remainingTime}
                  totalDuration={totalDuration}
                  manualEndTime={manualEndTime}
                  onManualEndTimeChange={setManualEndTime}
                />

                <CountdownTimer
                  remainingTime={remainingTime}
                  adjustedTimes={adjustedFinalTimes}
                  isTimerRunning={isTimerRunning}
                />

                <DurationAdjuster
                  totalDuration={totalDuration}
                  setTotalDuration={setTotalDuration}
                  originalTotalTime={originalTotalTime}
                  scaleFactor={getScaleFactor()}
                  darkMode={darkMode}
                />

                <QuickStats
                  analysisResult={analysisResult}
                  currentManualParagraph={currentManualParagraph}
                  readingSpeed={readingSpeed}
                  darkMode={darkMode}
                />

                <NotificationSettings
                  soundEnabled={soundEnabled}
                  setSoundEnabled={setSoundEnabled}
                  vibrationEnabled={vibrationEnabled}
                  setVibrationEnabled={setVibrationEnabled}
                  alertTimes={alertTimes}
                  setAlertTimes={setAlertTimes}
                  onTestSound={() => playNotificationSound('warning')}
                  onTestVibration={() => triggerVibration([200, 100, 200])}
                  overtimeAlertEnabled={overtimeAlertEnabled}
                  setOvertimeAlertEnabled={setOvertimeAlertEnabled}
                  darkMode={darkMode}
                />

                {/* Statistics Panel - shows after at least one paragraph is completed */}
                <ParagraphStatsPanel
                  paragraphStats={paragraphStats}
                  totalParagraphs={analysisResult.paragraphs.length}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Presentation Mode Overlay */}
      {isPresentationMode && (
        <PresentationMode
          analysisResult={analysisResult}
          elapsedTime={elapsedTime}
          remainingTime={remainingTime}
          isTimerRunning={isTimerRunning}
          onToggleTimer={toggleTimer}
          onResetTimer={resetTimer}
          onExit={exitPresentationMode}
          currentParagraphIndex={currentManualParagraph}
          theme={presentationTheme}
          onThemeChange={setPresentationTheme}
          totalDurationSeconds={totalDurationSeconds}
          startTime={startTime}
          endTime={endTime}
          introductionTime={introductionDuration}
          conclusionTime={closingWordsDuration}
          onStartStudy={startIntroductionMode}
          studyPhase={presentationPhase}
          onPhaseChange={setPresentationPhase}
          externalReviewQuestion={presentationReviewQuestion}
          onReviewQuestionChange={setPresentationReviewQuestion}
          scaleFactor={getScaleFactor()}
        />
      )}
    </div>
  );
}
