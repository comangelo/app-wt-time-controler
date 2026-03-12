import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  EyeOff,
  MessageSquarePlus,
  Bell,
  Volume2,
  VolumeX,
  Vibrate
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
import { Switch } from "@/components/ui/switch";
import PresentationMode from "@/components/PresentationMode";

// Import refactored components
import { UploadZone } from "@/components/UploadZone";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { TimerDisplay } from "@/components/TimerDisplay";
import { CountdownTimer } from "@/components/CountdownTimer";
import { QuickStats } from "@/components/QuickStats";
import { ParagraphCard } from "@/components/ParagraphCard";
import { FinalQuestionsSection } from "@/components/FinalQuestionsSection";
import { ParagraphStatsPanel } from "@/components/ParagraphStatsPanel";
import { IntroductionWordsSection } from "@/components/IntroductionWordsSection";
import { DurationAdjuster } from "@/components/DurationAdjuster";

// Import hooks
import { useLocalStorage, useLocalStorageString } from "@/hooks/useLocalStorage";
import { useNotifications } from "@/hooks/useNotifications";
import { useUpdateNotifier } from "@/hooks/useUpdateNotifier";
import { useScheduleCalculator } from "@/hooks/useScheduleCalculator";

// Import utils
import { addSecondsToDate } from "@/utils/timeFormatters";
import { darkThemes, defaultDarkTheme } from "@/utils/darkThemes";

const BACKEND_URL =
    process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8001";

const API = `${BACKEND_URL}/api`;

/**
 * Augments the analysis result by identifying "important ideas" in questions,
 * adding a 'highlight' content type, and adjusting time calculations.
 * @param {object} result The original analysis result from the backend.
 * @param {number} timePerHighlight The number of seconds to add for each highlight found.
 * @returns {object} The augmented analysis result.
 */
const augmentAnalysisResultWithHighlights = (result, timePerHighlight) => {
  if (!result || !result.paragraphs) return result;

  const augmentedResult = JSON.parse(JSON.stringify(result)); // Deep copy to avoid direct mutation
  let totalAddedTime = 0;
  let totalHighlights = 0;

  augmentedResult.paragraphs.forEach((p) => {
    let paragraphTimeIncrease = 0;
    p.questions.forEach((q) => {
      if (q.parenthesis_content?.includes('"') || q.parenthesis_content?.includes('“')) {
        // Use a global regex to find all matches, including smart quotes
        const matches = [...q.parenthesis_content.matchAll(/"(.*?)"|“(.*?)”/g)];

        if (matches.length > 0) {
          const highlightsInQuestion = matches.length;
          paragraphTimeIncrease += highlightsInQuestion * timePerHighlight;
          totalHighlights += highlightsInQuestion;

          q.content_type = q.content_type ? `${q.content_type}_highlight` : 'highlight';
          // Store all extracted texts in a new array property
          // A match will have the text in either group 1 (straight quotes) or group 2 (smart quotes)
          q.highlight_contents = matches.map((match) => match[1] || match[2]);
        }
      }
    });

    if (paragraphTimeIncrease > 0) {
      p.total_time_seconds += paragraphTimeIncrease;
      totalAddedTime += paragraphTimeIncrease;
    }
  });

  if (totalAddedTime > 0) {
    augmentedResult.total_time_seconds += totalAddedTime;
    toast.info(`${totalHighlights} "Ideas importantes" encontradas. Se añadieron ${totalAddedTime}s al tiempo total.`);
  }

  augmentedResult.total_highlights = totalHighlights;

  return augmentedResult;
};

export default function HomePage() {
  // Core state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
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
    now: false
  });
  // Settings with localStorage persistence
  const [soundEnabled, setSoundEnabled] = useLocalStorage('pdfTimer_soundEnabled', true);
  const [vibrationEnabled, setVibrationEnabled] = useLocalStorage('pdfTimer_vibrationEnabled', true);
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
  
  // Statistics tracking
  const [paragraphStats, setParagraphStats] = useState({});
  const [paragraphStartTime, setParagraphStartTime] = useState(null);
  const [commentStats, setCommentStats] = useState({ paragraphs: {}, review: {} });

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
  const [presentationPhase, setPresentationPhase] = useState('initial');
  const [presentationReviewQuestion, setPresentationReviewQuestion] = useState(0);
  
  // State for editing end time on initial screen (before PDF upload)
  const [isEditingInitialEndTime, setIsEditingInitialEndTime] = useState(false);
  const [initialEditHours, setInitialEditHours] = useState('');
  const [initialEditMinutes, setInitialEditMinutes] = useState('');
  
  // State for current segment (paragraph, intro, etc.) elapsed time
  const [currentSegmentElapsedTime, setCurrentSegmentElapsedTime] = useState(0);


  // Custom hooks
  // Hook to listen for app updates in the background
  useUpdateNotifier();

  const { playNotificationSound, triggerVibration } = useNotifications(soundEnabled, vibrationEnabled);
  const {
    getAdjustedFinalQuestionsTime,
    getAdjustedFinalQuestionTime,
    getAdjustedParagraphTimes,
    getFinalQuestionsTimeSeconds,
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

  // Comment handlers
  const handleAddComment = useCallback((index) => {
    if (presentationPhase === 'paragraphs') {
      setCommentStats(prev => ({
        ...prev,
        paragraphs: {
          ...prev.paragraphs,
          [index]: (prev.paragraphs[index] || 0) + 1,
        }
      }));
      // toast.success(`Comentario añadido al párrafo ${index + 1}`);
    } else if (presentationPhase === 'review') {
      setCommentStats(prev => ({
        ...prev,
        review: {
          ...prev.review,
          [index]: (prev.review[index] || 0) + 1,
        }
      }));
      // toast.success(`Comentario añadido a la pregunta de repaso ${index + 1}`);
    }
  }, [presentationPhase]);

  const totalComments = useMemo(() => {
    const paragraphComments = Object.values(commentStats.paragraphs).reduce((sum, count) => sum + count, 0);
    const reviewComments = Object.values(commentStats.review).reduce((sum, count) => sum + count, 0);
    return paragraphComments + reviewComments;
  }, [commentStats]);

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

  const currentParagraphGroup = useMemo(() => {
    if (!analysisResult?.paragraphs) return null;
    return groupedParagraphs.find(g => g.indices.includes(currentManualParagraph));
  }, [analysisResult, groupedParagraphs, currentManualParagraph]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    } else if (!startTime) {
      newPhase = 'initial';
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
  }, [isInIntroductionMode, isInReviewMode, isInClosingWordsMode, isTimerRunning, currentManualParagraph, currentReviewQuestion, presentationPhase, startTime]);

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
    // toast.success(`Avanzando al Párrafo ${nextIndex + 1}`);
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

    if (timeUntilFinalQuestions <= 0 && timeUntilFinalQuestions > -5 && !notificationPlayed.now) {
      playNotificationSound('final');
      triggerVibration([500, 200, 500, 200, 500]);
      setNotificationPlayed(prev => ({ ...prev, now: true }));
      toast.success("🎯 ¡Es hora de las preguntas de repaso!", { duration: 8000 });
    }
  }, [elapsedTime, isTimerRunning, analysisResult, notificationPlayed, playNotificationSound, getFinalQuestionsTimeSeconds, triggerVibration]);

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
        const now = Date.now();
        
        // Recalculate from start/end times to prevent drift from setInterval throttling
        if (startTime && endTime) {
          const elapsed = Math.round((now - startTime.getTime()) / 1000);
          const remaining = Math.round((endTime.getTime() - now) / 1000);
          setElapsedTime(elapsed);
          setRemainingTime(remaining);
        }

        // Calculate current segment elapsed time to sync timers
        let segmentStart = null;
        if (isInIntroductionMode) {
            segmentStart = introductionStartTime;
        } else if (isInReviewMode) {
            segmentStart = reviewQuestionStartTime;
        } else if (isInClosingWordsMode) {
            segmentStart = closingWordsStartTime;
        } else if (currentManualParagraph >= 0 && paragraphStartTime) {
            segmentStart = paragraphStartTime;
        }

        if (segmentStart) {
            setCurrentSegmentElapsedTime(Math.round((now - segmentStart) / 1000));
        } else {
            // If no segment is active, reset its timer
            setCurrentSegmentElapsedTime(0);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => { // Cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [
    isTimerRunning, 
    startTime, 
    endTime, 
    isInIntroductionMode, 
    introductionStartTime, 
    isInReviewMode, 
    reviewQuestionStartTime, 
    isInClosingWordsMode, 
    closingWordsStartTime, 
    currentManualParagraph, 
    paragraphStartTime
  ]);

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
      
      const finalResult = augmentAnalysisResultWithHighlights(response.data, answerTime);
      
      setAnalysisResult(finalResult);
      setElapsedTime(0);
      setIsTimerRunning(false);
      setStartTime(null);
      setEndTime(null);
      setCurrentManualParagraph(0);
      setCommentStats({ paragraphs: {}, review: {} }); // Reset comments
      setPresentationPhase('initial'); // Reset phase
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
    setNotificationPlayed({ now: false });
    setCurrentManualParagraph(0);
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
    setCommentStats({ paragraphs: {}, review: {} }); // Reset comments
    setPresentationPhase('initial'); // Reset phase
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
    
    // toast.success("Iniciando Palabras de Introducción");
  }, [manualEndTime, totalDurationSeconds]);

  // Move to first paragraph after introduction
  const goToFirstParagraph = useCallback(() => {
    if (introductionStartTime) {
      const actualIntroTime = (Date.now() - introductionStartTime) / 1000;
      const plannedIntroTime = getScaledIntroductionTime();
      const timeDifference = plannedIntroTime - actualIntroTime;
      
      setRemainingTime(prev => prev + timeDifference);
      
      if (Math.abs(timeDifference) > 1) {
        const message = timeDifference > 0 
          ? `Ganaste ${Math.round(timeDifference)}s en la introducción. ¡Añadido al resto!`
          : `Te pasaste ${Math.round(Math.abs(timeDifference))}s en la introducción. ¡Ajustando!`;
        toast.info(message);
      }
    }

    setIsInIntroductionMode(false);
    setCurrentManualParagraph(0);
    setParagraphStartTime(Date.now());
    setPresentationPhase('paragraphs'); // Sync presentation phase
    // toast.success("Pasando al Párrafo 1");
  }, [introductionStartTime, getScaledIntroductionTime]);

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
      // toast.success(`Pregunta de repaso ${nextQuestion + 1}`);
    }
  }, [currentReviewQuestion, analysisResult]);

  // Start closing words mode
  const startClosingWordsMode = useCallback(() => {
    if (reviewQuestionStartTime) {
      const adjustedTimes = getAdjustedFinalQuestionsTime();
      const actualReviewTime = (Date.now() - reviewQuestionStartTime) / 1000;
      const plannedReviewTime = adjustedTimes.totalTime || 0;
      const timeDifference = plannedReviewTime - actualReviewTime;

      setRemainingTime(prev => prev + timeDifference);

      if (Math.abs(timeDifference) > 1) {
        const message = timeDifference > 0 
          ? `Ganaste ${Math.round(timeDifference)}s en el repaso. ¡Añadido a la conclusión!`
          : `Te pasaste ${Math.round(Math.abs(timeDifference))}s en el repaso. ¡Ajustando!`;
        toast.info(message);
      }
    }

    setIsInClosingWordsMode(true);
    setClosingWordsStartTime(Date.now());
    setPresentationPhase('conclusion'); // Sync presentation phase
    toast.success("Iniciando Palabras de Conclusión");
  }, [reviewQuestionStartTime, getAdjustedFinalQuestionsTime]);

  // Finish study
  const finishStudy = useCallback(() => {
    if (closingWordsStartTime) {
      const actualConclusionTime = (Date.now() - closingWordsStartTime) / 1000;
      const plannedConclusionTime = getScaledConclusionTime();
      const timeDifference = plannedConclusionTime - actualConclusionTime;

      setRemainingTime(prev => prev + timeDifference);
    }

    setIsTimerRunning(false);
    setIsInClosingWordsMode(false);
    setIsInReviewMode(false);
    setPresentationPhase('finished'); // Sync presentation phase
    toast.success("¡Estudio finalizado! 🎉");
  }, [closingWordsStartTime, getScaledConclusionTime]);

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
    setNotificationPlayed({ now: false });
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
            <div className={`flex items-center gap-1 sm:gap-2 p-1 rounded-full ${darkMode ? 'bg-zinc-900/50' : 'bg-slate-100/50'}`}>
              {/* Dark Mode Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full w-10 h-10 sm:w-11 sm:h-11 transition-colors ${
                      darkMode 
                        ? 'text-yellow-400 hover:bg-zinc-700 hover:text-yellow-300' 
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                    title={darkMode ? 'Opciones de modo oscuro' : 'Activar modo oscuro'}
                    data-testid="dark-mode-toggle"
                  >
                    {darkMode ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" />}
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

              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full w-10 h-10 sm:w-11 sm:h-11 transition-colors ${
                      darkMode
                        ? 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Configurar notificaciones"
                  >
                    <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`rounded-xl min-w-[240px] ${darkMode ? 'bg-zinc-800 border-zinc-700' : ''}`}>
                  <DropdownMenuLabel className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                    Notificaciones
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className={darkMode ? 'bg-zinc-700' : ''} />
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={`cursor-pointer ${darkMode ? 'hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-green-500" /> : <VolumeX className={`w-4 h-4 ${darkMode ? 'text-zinc-400' : 'text-zinc-400'}`} />}
                        <span className={`text-sm ${darkMode ? 'text-zinc-200' : ''}`}>Sonido</span>
                      </div>
                      <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={`cursor-pointer ${darkMode ? 'hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Vibrate className={`w-4 h-4 ${vibrationEnabled ? 'text-green-500' : darkMode ? 'text-zinc-400' : 'text-zinc-400'}`} />
                        <span className={`text-sm ${darkMode ? 'text-zinc-200' : ''}`}>Vibración</span>
                      </div>
                      <Switch checked={vibrationEnabled} onCheckedChange={setVibrationEnabled} />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className={darkMode ? 'bg-zinc-700' : ''} />
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={`cursor-pointer ${darkMode ? 'hover:bg-zinc-700 focus:bg-zinc-700' : ''}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Timer className={`w-4 h-4 ${overtimeAlertEnabled ? 'text-orange-500' : darkMode ? 'text-zinc-400' : 'text-zinc-400'}`} />
                        <span className={`text-sm ${darkMode ? 'text-zinc-200' : ''}`}>Alerta de exceso</span>
                      </div>
                      <Switch checked={overtimeAlertEnabled} onCheckedChange={setOvertimeAlertEnabled} />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {analysisResult && (
                <>
                <Button 
                  variant="outline" 
                  onClick={enterPresentationMode} 
                  className={`rounded-full h-10 sm:h-11 px-3 sm:px-5 border-2 font-semibold transition-all text-xs sm:text-sm ${
                    darkMode
                      ? 'border-zinc-600 bg-zinc-700 text-zinc-100 hover:border-orange-400 hover:text-orange-400 hover:bg-orange-500/10'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                  data-testid="presentation-mode-btn"
                >
                  <Maximize className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                  <span className="hidden sm:inline">Presentación</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={`rounded-full h-10 sm:h-11 px-3 sm:px-5 border-2 font-semibold text-xs sm:text-sm ${
                        darkMode
                          ? 'border-zinc-600 bg-zinc-700 text-zinc-100 hover:border-zinc-400'
                          : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-400'
                      }`}
                      data-testid="export-btn"
                    >
                      <Download className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
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
                  className={`rounded-full h-10 sm:h-11 px-3 sm:px-4 font-semibold text-xs sm:text-sm ${
                    darkMode
                      ? 'bg-red-900/80 text-red-300 hover:bg-red-800 hover:text-red-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                  data-testid="new-analysis-btn"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
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
            <div className="bg-gradient-to-br from-zinc-800 to-zinc-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl border border-zinc-600">

              {/* Current Time Clock - Always visible */}
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="inline-flex items-center gap-2 sm:gap-3 bg-zinc-700/50 rounded-full px-4 sm:px-6 py-2 border border-zinc-600">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
                  <span className="text-xs sm:text-sm text-zinc-400 uppercase tracking-wider font-medium">Hora actual</span>
                  <span
                      className="text-xl sm:text-2xl font-bold text-white"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
                  >
        {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
                </div>
              </div>

              {/* Main Time Display Grid */}
              <div className="grid grid-cols-3 gap-4 sm:gap-8 items-center">

                {/* Start Time - Empty until started */}
                <div className="text-center">
                  <div className="inline-block bg-emerald-900/50 rounded-xl px-3 py-1 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-widest">Inicio</span>
                  </div>
                  <p
                      className="text-2xl sm:text-4xl md:text-5xl font-black text-zinc-500"
                      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}
                  >
                    --:--
                  </p>
                </div>

                {/* Duration - Center */}
                <div className="flex flex-col items-center">
                  <div className="inline-block bg-orange-900/50 rounded-xl px-3 py-1 mb-2">
                    <span className="text-xs sm:text-sm font-bold text-orange-400 uppercase tracking-widest">Duración</span>
                  </div>
                  <span className={`text-2xl sm:text-4xl md:text-5xl font-black ${manualEndTime ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]'}`}>
        {manualEndTime
            ? Math.max(0, Math.round((manualEndTime.getTime() - new Date().getTime()) / 60000))
            : totalDuration}
                    <span className="text-lg sm:text-2xl ml-1">min</span>
      </span>
                </div>

                {/* End Time - Editable - Bright Yellow/Amber */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-yellow-900/50 rounded-xl px-3 py-1 mb-2">
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
                            className="p-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 transition-all hover:scale-110"
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
                              className="w-14 sm:w-20 h-12 sm:h-16 text-center bg-zinc-700 border-2 border-yellow-500/50 rounded-xl text-yellow-300 text-2xl sm:text-4xl font-black focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                              placeholder="HH"
                              maxLength={2}
                              autoFocus
                          />
                          <span className="text-yellow-400 text-3xl sm:text-4xl font-black animate-pulse">:</span>
                          <input
                              type="text"
                              value={initialEditMinutes}
                              onChange={(e) => setInitialEditMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                              className="w-14 sm:w-20 h-12 sm:h-16 text-center bg-zinc-700 border-2 border-yellow-500/50 rounded-xl text-yellow-300 text-2xl sm:text-4xl font-black focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
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
              <div className="text-center mt-4 sm:mt-6 pt-4 border-t border-zinc-600">
                {manualEndTime ? (
                    <button
                        onClick={() => setManualEndTime(null)}
                        className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restaurar hora automática
                    </button>
                ) : (
                    <p className="text-zinc-400 text-sm">
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
                totalComments={totalComments}
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
                    const isCurrentGroup = isTimerRunning && !isInIntroductionMode && group.indices.includes(currentManualParagraph);
                    const isCompletedGroup = presentationPhase === 'finished' || (!isInIntroductionMode && lastIndex < currentManualParagraph);
                    
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
                        paragraphElapsed={isCurrentGroup ? currentSegmentElapsedTime : 0}
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
                            // toast.success(`Avanzando al Párrafo ${analysisResult.paragraphs[lastIndex + 1].number}`);
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
                        onAddComment={() => handleAddComment(firstIndex)}
                        commentCount={commentStats.paragraphs[firstIndex] || 0}
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
                  onAddComment={handleAddComment}
                  commentStats={commentStats.review}
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
          onExit={exitPresentationMode}
          currentParagraphIndex={currentManualParagraph}
          theme={presentationTheme}
          startTime={startTime}
          endTime={endTime}
          manualEndTime={manualEndTime}
          introductionTime={introductionDuration}
          conclusionTime={conclusionDuration}
          studyPhase={presentationPhase}
          onPhaseChange={setPresentationPhase}
          phaseElapsedTime={currentSegmentElapsedTime}
          externalReviewQuestion={presentationReviewQuestion}
          onReviewQuestionChange={setPresentationReviewQuestion}
          scaleFactor={getScaleFactor()}
          onAddComment={handleAddComment}
          onStartStudy={startIntroductionMode}
          onGoToFirstParagraph={goToFirstParagraph}
          onGoToNext={goToNextParagraph}
          onStartReview={startReviewMode}
          onNextReviewQuestion={goToNextReviewQuestion}
          onStartClosingWords={startClosingWordsMode}
          onFinishStudy={finishStudy}
          totalComments={totalComments}
          currentParagraphGroup={currentParagraphGroup}
          getAdjustedParagraphTimes={getAdjustedParagraphTimes}
        />
      )}
    </div>
  );
}
