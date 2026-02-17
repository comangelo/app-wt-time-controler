import { useCallback, useMemo } from 'react';
import { addSecondsToDate } from '../utils/timeFormatters';

export function useScheduleCalculator(
  analysisResult, 
  startTime, 
  remainingTime, 
  currentManualParagraph,
  totalDurationSeconds = 3600,
  introductionDuration = 60,
  conclusionDuration = 60
) {
  
  // Base durations for intro/conclusion (used to calculate original time)
  const BASE_INTRO_DURATION = 60;
  const BASE_CONCLUSION_DURATION = 60;
  
  // Calculate the original total time of the article (without scaling)
  // This uses base durations for intro/conclusion to avoid circular dependency
  const originalTotalTime = useMemo(() => {
    if (!analysisResult) return 3600;
    
    // Sum of all paragraph times + final questions time + base intro + base conclusion
    const paragraphsTime = analysisResult.paragraphs.reduce(
      (sum, p) => sum + p.total_time_seconds, 0
    );
    const finalQuestionsTime = (analysisResult.final_questions?.length || 0) * 35;
    
    return paragraphsTime + finalQuestionsTime + BASE_INTRO_DURATION + BASE_CONCLUSION_DURATION;
  }, [analysisResult]);

  // Calculate scale factor: how much to scale all times
  const getScaleFactor = useCallback(() => {
    if (!analysisResult || originalTotalTime === 0) return 1;
    
    // Scale factor = desired duration / original duration
    const factor = totalDurationSeconds / originalTotalTime;
    
    // Limit to reasonable bounds (0.5x to 2x)
    return Math.max(0.5, Math.min(2, factor));
  }, [analysisResult, totalDurationSeconds, originalTotalTime]);

  // Get scaled introduction time
  const getScaledIntroductionTime = useCallback(() => {
    const factor = getScaleFactor();
    return Math.round(introductionDuration * factor);
  }, [getScaleFactor, introductionDuration]);

  // Get scaled conclusion time
  const getScaledConclusionTime = useCallback(() => {
    const factor = getScaleFactor();
    return Math.round(conclusionDuration * factor);
  }, [getScaleFactor, conclusionDuration]);

  // Calculate adjusted time for final questions based on manual progress and scale factor
  const getAdjustedFinalQuestionsTime = useCallback(() => {
    if (!startTime || !analysisResult) return { start: null, end: null };
    
    const finalQuestionsCount = analysisResult.final_questions?.length || 0;
    if (finalQuestionsCount === 0) return { start: null, end: null };
    
    const scaleFactor = getScaleFactor();
    
    // Calculate remaining paragraphs
    const remainingParagraphs = analysisResult.paragraphs.slice(currentManualParagraph);
    
    // Scaled reading time for remaining paragraphs
    const scaledReadingTime = remainingParagraphs.reduce(
      (sum, p) => sum + (p.reading_time_seconds * scaleFactor), 0
    );
    
    // Count total questions (paragraphs + final questions)
    const remainingParagraphsQuestionCount = remainingParagraphs.reduce(
      (sum, p) => sum + p.questions.length, 0
    );
    const totalQuestionCount = remainingParagraphsQuestionCount + finalQuestionsCount;
    
    // Time available for ALL questions = remaining time - scaled reading time
    const timeForAllQuestions = Math.max(0, remainingTime - scaledReadingTime);
    
    // Adjusted time per question (distributed equally among all remaining questions)
    const adjustedTimePerQuestion = totalQuestionCount > 0 
      ? Math.round(timeForAllQuestions / totalQuestionCount)
      : Math.round(35 * scaleFactor);
    
    // Time for final questions specifically
    const totalFinalQuestionsTime = finalQuestionsCount * adjustedTimePerQuestion;
    
    // Calculate when final questions start (after reading time + paragraph questions)
    const paragraphsQuestionTime = remainingParagraphsQuestionCount * adjustedTimePerQuestion;
    const timeUntilFinalQuestions = scaledReadingTime + paragraphsQuestionTime;
    
    const now = new Date();
    const adjustedStart = addSecondsToDate(now, timeUntilFinalQuestions);
    const adjustedEnd = addSecondsToDate(adjustedStart, totalFinalQuestionsTime);
    
    return { 
      start: adjustedStart, 
      end: adjustedEnd,
      totalTime: totalFinalQuestionsTime,
      perQuestion: adjustedTimePerQuestion,
      originalPerQuestion: Math.round(35 * scaleFactor),
      scaleFactor
    };
  }, [startTime, analysisResult, currentManualParagraph, remainingTime, getScaleFactor]);

  // Get adjusted time for each individual final question
  const getAdjustedFinalQuestionTime = useCallback((questionIndex) => {
    if (!startTime || !analysisResult) return null;
    
    const adjusted = getAdjustedFinalQuestionsTime();
    if (!adjusted.start) return null;
    
    return addSecondsToDate(adjusted.start, questionIndex * adjusted.perQuestion);
  }, [startTime, analysisResult, getAdjustedFinalQuestionsTime]);

  // Calculate adjusted paragraph times based on remaining time and scale factor
  const getAdjustedParagraphTimes = useCallback((paragraphIndex) => {
    if (!startTime || !analysisResult) return { start: null, end: null, adjustedDuration: 0 };
    
    const paragraph = analysisResult.paragraphs[paragraphIndex];
    const scaleFactor = getScaleFactor();
    
    // If paragraph is before current, it's completed - use scaled original times
    if (paragraphIndex < currentManualParagraph) {
      let cumulativeTime = 0;
      for (let i = 0; i < paragraphIndex; i++) {
        cumulativeTime += analysisResult.paragraphs[i].total_time_seconds * scaleFactor;
      }
      const scaledDuration = paragraph.total_time_seconds * scaleFactor;
      const paragraphStart = addSecondsToDate(startTime, cumulativeTime);
      const paragraphEnd = addSecondsToDate(startTime, cumulativeTime + scaledDuration);
      return { 
        start: paragraphStart, 
        end: paragraphEnd, 
        adjustedDuration: Math.round(scaledDuration),
        adjustedQuestionTime: Math.round(35 * scaleFactor),
        isCompleted: true,
        scaleFactor
      };
    }
    
    // Calculate remaining content
    const remainingParagraphs = analysisResult.paragraphs.slice(currentManualParagraph);
    const finalQuestionsCount = analysisResult.final_questions?.length || 0;
    
    // Scaled total reading time for remaining paragraphs
    const totalScaledReadingTime = remainingParagraphs.reduce(
      (sum, p) => sum + (p.reading_time_seconds * scaleFactor), 0
    );
    
    // Total question count (paragraphs + final questions)
    const totalQuestionCount = remainingParagraphs.reduce(
      (sum, p) => sum + p.questions.length, 0
    ) + finalQuestionsCount;
    
    // Time available for ALL questions
    const timeForAllQuestions = Math.max(0, remainingTime - totalScaledReadingTime);
    
    // Adjusted time per question
    const adjustedTimePerQuestion = totalQuestionCount > 0 
      ? timeForAllQuestions / totalQuestionCount
      : 35 * scaleFactor;
    
    // Calculate start time for this paragraph
    let cumulativeTime = 0;
    for (let i = currentManualParagraph; i < paragraphIndex; i++) {
      const p = analysisResult.paragraphs[i];
      // Scaled reading time + adjusted question time
      cumulativeTime += (p.reading_time_seconds * scaleFactor) + (p.questions.length * adjustedTimePerQuestion);
    }
    
    const now = new Date();
    const adjustedStart = addSecondsToDate(now, cumulativeTime);
    
    // This paragraph's duration: scaled reading + adjusted questions
    const thisParaDuration = (paragraph.reading_time_seconds * scaleFactor) + (paragraph.questions.length * adjustedTimePerQuestion);
    const adjustedEnd = addSecondsToDate(adjustedStart, thisParaDuration);
    
    return { 
      start: adjustedStart, 
      end: adjustedEnd, 
      adjustedDuration: Math.round(thisParaDuration),
      adjustedQuestionTime: Math.round(adjustedTimePerQuestion),
      isCompleted: false,
      isCurrent: paragraphIndex === currentManualParagraph,
      scaleFactor
    };
  }, [startTime, analysisResult, currentManualParagraph, remainingTime, getScaleFactor]);

  // Calculate paragraph times based on start time (scaled, not adjusted by progress)
  const getParagraphTimes = useCallback((paragraphIndex) => {
    if (!startTime || !analysisResult) return { start: null, end: null };
    
    const scaleFactor = getScaleFactor();
    
    let cumulativeTime = 0;
    for (let i = 0; i < paragraphIndex; i++) {
      cumulativeTime += analysisResult.paragraphs[i].total_time_seconds * scaleFactor;
    }
    
    const scaledDuration = analysisResult.paragraphs[paragraphIndex].total_time_seconds * scaleFactor;
    const paragraphStart = addSecondsToDate(startTime, cumulativeTime);
    const paragraphEnd = addSecondsToDate(startTime, cumulativeTime + scaledDuration);
    
    return { start: paragraphStart, end: paragraphEnd, scaleFactor };
  }, [startTime, analysisResult, getScaleFactor]);

  // Get final questions time in seconds from start (scaled)
  const getFinalQuestionsTimeSeconds = useCallback(() => {
    if (!analysisResult) return 0;
    
    const scaleFactor = getScaleFactor();
    
    let cumulativeTime = 0;
    for (const para of analysisResult.paragraphs) {
      cumulativeTime += para.reading_time_seconds * scaleFactor;
      if (para.questions.some(q => q.is_final_question)) {
        return cumulativeTime;
      }
      cumulativeTime += para.questions.length * 35 * scaleFactor;
    }
    
    if (analysisResult.final_questions_start_time > 0) {
      return analysisResult.final_questions_start_time * scaleFactor;
    }
    
    return 0;
  }, [analysisResult, getScaleFactor]);

  // Get final questions time as Date
  const getFinalQuestionsTime = useCallback(() => {
    if (!startTime || !analysisResult) return null;
    const seconds = getFinalQuestionsTimeSeconds();
    if (seconds > 0) {
      return addSecondsToDate(startTime, seconds);
    }
    return null;
  }, [startTime, analysisResult, getFinalQuestionsTimeSeconds]);

  return {
    getAdjustedFinalQuestionsTime,
    getAdjustedFinalQuestionTime,
    getAdjustedParagraphTimes,
    getParagraphTimes,
    getFinalQuestionsTimeSeconds,
    getFinalQuestionsTime,
    getScaleFactor,
    getScaledIntroductionTime,
    getScaledConclusionTime,
    originalTotalTime,
  };
}
