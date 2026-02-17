import { FileText, MessageCircle, HelpCircle, Image, BookOpen, Layers, StickyNote, Clock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeCompact } from "../utils/timeFormatters";

// Format filename to extract article number and title
function parseFilename(filename) {
  if (!filename) return { articleLine: '', titleLine: '' };
  
  // Remove extension
  let name = filename.replace(/\.[^/.]+$/, '');
  
  // Replace underscores and hyphens with spaces
  name = name.replace(/[_-]/g, ' ');
  
  // Try to extract: "Articulo de Estudio XX resto del titulo"
  // Pattern matches variations like "Articulo de Estudio 49 Como nos ayuda..."
  const match = name.match(/^(?:articulo\s*(?:de\s*)?(?:estudio\s*)?|article\s*|art\s*)(\d+)\s*(.*)$/i);
  
  if (match) {
    const number = match[1];
    let title = match[2].trim();
    
    // Capitalize first letter, rest lowercase, then capitalize after spaces
    title = title.toLowerCase().replace(/(?:^|\s)\S/g, char => char.toUpperCase());
    
    return {
      articleLine: `ARTÍCULO DE ESTUDIO ${number}`,
      titleLine: title
    };
  }
  
  // If no match, just return the whole name as title
  let title = name.toLowerCase().replace(/(?:^|\s)\S/g, char => char.toUpperCase());
  return {
    articleLine: 'ARTÍCULO DE ESTUDIO',
    titleLine: title
  };
}

export function AnalysisSummary({ 
  analysisResult, 
  darkMode = false,
  totalDurationMinutes = 60,
  introductionDuration = 60,
  closingWordsDuration = 60
}) {
  if (!analysisResult) return null;

  const paragraphQuestions = analysisResult.total_paragraph_questions || 
    analysisResult.paragraphs.reduce(
      (sum, p) => sum + p.questions.filter(q => !q.is_final_question).length, 0
    );
  const reviewQuestions = analysisResult.total_review_questions || analysisResult.final_questions?.length || 0;
  const totalImages = analysisResult.total_images || 0;
  const totalScriptures = analysisResult.total_scriptures || 0;
  const totalNotes = analysisResult.total_notes || 0;
  const totalParagraphs = analysisResult.total_paragraphs || 0;

  // Time calculations
  const readingTimeSeconds = analysisResult.total_reading_time_seconds || 0;
  const questionTimeSeconds = analysisResult.total_question_time_seconds || 0;
  const articleTimeSeconds = readingTimeSeconds + questionTimeSeconds;
  const totalDurationSeconds = totalDurationMinutes * 60;
  const fixedTimeSeconds = introductionDuration + closingWordsDuration;
  const availableTimeSeconds = totalDurationSeconds - articleTimeSeconds - fixedTimeSeconds;

  // Parse the filename into article line and title
  const { articleLine, titleLine } = parseFilename(analysisResult.filename);

  return (
    <Card className={`mb-8 shadow-sm ${darkMode ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-100'}`} data-testid="analysis-summary">
      <CardContent className="p-6">
        {/* Header with formatted title */}
        <div className="mb-6">
          <p className={`text-sm font-bold tracking-wide mb-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {articleLine}
          </p>
          <h3 className={`font-heading font-bold text-2xl leading-tight ${darkMode ? 'text-orange-400' : 'text-orange-600'}`} data-testid="pdf-filename">
            {titleLine}
          </h3>
          <p className={`text-sm mt-2 ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {analysisResult.total_words} palabras
          </p>
        </div>

        {/* Stats Pills Row */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            darkMode 
              ? 'bg-zinc-700 text-zinc-200 border border-zinc-600' 
              : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
          }`} data-testid="paragraphs-count">
            <Layers className="w-4 h-4" />
            <span>{totalParagraphs}</span>
            <span className={`${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>{totalParagraphs === 1 ? 'párrafo' : 'párrafos'}</span>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            darkMode 
              ? 'bg-orange-900/60 text-orange-200 border border-orange-700' 
              : 'bg-orange-50 text-orange-700 border border-orange-200'
          }`} data-testid="paragraph-questions-count">
            <MessageCircle className="w-4 h-4" />
            <span>{paragraphQuestions}</span>
            <span className={`${darkMode ? 'text-orange-300/70' : 'text-orange-600/70'}`}>{paragraphQuestions === 1 ? 'pregunta' : 'preguntas'}</span>
          </div>
          
          {totalScriptures > 0 && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              darkMode 
                ? 'bg-blue-900/60 text-blue-200 border border-blue-700' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`} data-testid="scriptures-count">
              <BookOpen className="w-4 h-4" />
              <span>{totalScriptures}</span>
              <span className={`${darkMode ? 'text-blue-300/70' : 'text-blue-600/70'}`}>{totalScriptures === 1 ? 'texto' : 'textos'}</span>
            </div>
          )}

          {totalImages > 0 && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              darkMode 
                ? 'bg-purple-900/60 text-purple-200 border border-purple-700' 
                : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`} data-testid="images-count">
              <Image className="w-4 h-4" />
              <span>{totalImages}</span>
              <span className={`${darkMode ? 'text-purple-300/70' : 'text-purple-600/70'}`}>{totalImages === 1 ? 'imagen' : 'imágenes'}</span>
            </div>
          )}
          
          {totalNotes > 0 && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              darkMode 
                ? 'bg-amber-900/60 text-amber-200 border border-amber-700' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`} data-testid="notes-count">
              <StickyNote className="w-4 h-4" />
              <span>{totalNotes}</span>
              <span className={`${darkMode ? 'text-amber-300/70' : 'text-amber-600/70'}`}>{totalNotes === 1 ? 'nota' : 'notas'}</span>
            </div>
          )}
          
          {reviewQuestions > 0 && (
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              darkMode 
                ? 'bg-red-900/60 text-red-200 border border-red-700' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`} data-testid="review-questions-count">
              <HelpCircle className="w-4 h-4" />
              <span>{reviewQuestions}</span>
              <span className={`${darkMode ? 'text-red-300/70' : 'text-red-600/70'}`}>repaso</span>
            </div>
          )}
        </div>

        {/* Time Cards - Modern Grid (2x2 en móvil, 4 columnas en desktop) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Lectura */}
          <div className={`relative overflow-hidden rounded-2xl p-4 ${
            darkMode 
              ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700' 
              : 'bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200'
          }`}>
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-30 ${
              darkMode ? 'bg-slate-500' : 'bg-slate-400'
            }`}></div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
              darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>Lectura</p>
            <p className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`} data-testid="reading-time">
              {formatTimeCompact(readingTimeSeconds)}
            </p>
          </div>

          {/* Respuestas */}
          <div className={`relative overflow-hidden rounded-2xl p-4 ${
            darkMode 
              ? 'bg-gradient-to-br from-orange-950 to-orange-900 border border-orange-800' 
              : 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200'
          }`}>
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-30 ${
              darkMode ? 'bg-orange-500' : 'bg-orange-400'
            }`}></div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
              darkMode ? 'text-orange-400' : 'text-orange-600'
            }`}>Respuestas</p>
            <p className={`text-2xl font-bold ${darkMode ? 'text-orange-300' : 'text-orange-600'}`} data-testid="question-time">
              {formatTimeCompact(questionTimeSeconds)}
            </p>
          </div>

          {/* Artículo (Total) */}
          <div className={`relative overflow-hidden rounded-2xl p-4 ${
            darkMode 
              ? 'bg-gradient-to-br from-blue-950 to-blue-900 border border-blue-800' 
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
          }`}>
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-30 ${
              darkMode ? 'bg-blue-500' : 'bg-blue-400'
            }`}></div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
              darkMode ? 'text-blue-400' : 'text-blue-600'
            }`}>Artículo</p>
            <p className={`text-2xl font-bold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} data-testid="article-time">
              {formatTimeCompact(articleTimeSeconds)}
            </p>
          </div>

          {/* Tiempo Disponible */}
          <div className={`relative overflow-hidden rounded-2xl p-4 ${
            availableTimeSeconds >= 0
              ? darkMode 
                ? 'bg-gradient-to-br from-emerald-950 to-emerald-900 border-2 border-emerald-600' 
                : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300'
              : darkMode 
                ? 'bg-gradient-to-br from-red-950 to-red-900 border-2 border-red-600' 
                : 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300'
          }`}>
            <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-40 ${
              availableTimeSeconds >= 0 
                ? darkMode ? 'bg-emerald-500' : 'bg-emerald-400'
                : darkMode ? 'bg-red-500' : 'bg-red-400'
            }`}></div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className={`w-3 h-3 ${
                availableTimeSeconds >= 0
                  ? darkMode ? 'text-emerald-400' : 'text-emerald-600'
                  : darkMode ? 'text-red-400' : 'text-red-600'
              }`} />
              <p className={`text-xs font-bold uppercase tracking-wider ${
                availableTimeSeconds >= 0
                  ? darkMode ? 'text-emerald-400' : 'text-emerald-600'
                  : darkMode ? 'text-red-400' : 'text-red-600'
              }`}>Disponible</p>
            </div>
            <p className={`text-2xl font-bold ${
              availableTimeSeconds >= 0
                ? darkMode ? 'text-emerald-300' : 'text-emerald-600'
                : darkMode ? 'text-red-300' : 'text-red-600'
            }`} data-testid="available-time">
              {availableTimeSeconds >= 0 
                ? formatTimeCompact(availableTimeSeconds) 
                : `-${formatTimeCompact(Math.abs(availableTimeSeconds))}`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
