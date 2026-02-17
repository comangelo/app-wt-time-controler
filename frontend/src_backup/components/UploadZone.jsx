import { Upload, Clock, MessageCircleQuestion } from "lucide-react";

export function UploadZone({ 
  onFileSelect, 
  isDragging, 
  isLoading, 
  onDragOver, 
  onDragLeave, 
  onDrop,
  fileInputRef,
  readingSpeed = 180,
  answerTime = 35,
  darkMode = false
}) {
  const handleClick = () => fileInputRef.current?.click();
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelect(file);
  };

  const getSpeedLabel = (speed) => {
    if (speed <= 150) return "Lento";
    if (speed >= 210) return "Rápido";
    return "Normal";
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h2 className="font-heading font-extrabold text-4xl md:text-5xl text-orange-500 tracking-tight mb-4">
          ATALAYA DE ESTUDIO
        </h2>
        <p className={`text-lg max-w-md mx-auto leading-relaxed ${darkMode ? 'text-zinc-400' : 'text-slate-700'}`}>
          Calculadora de Tiempo de conducción
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onClick={handleClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          cursor-pointer border-2 border-dashed rounded-3xl p-12 md:p-16 text-center
          transition-all duration-300 ease-out
          ${isDragging 
            ? 'border-orange-500 bg-orange-50 scale-[1.02] shadow-xl shadow-orange-100' 
            : darkMode
              ? 'border-zinc-600 bg-zinc-800/50 hover:border-orange-400 hover:bg-zinc-800 hover:shadow-lg'
              : 'border-slate-300 bg-slate-50/50 hover:border-orange-400 hover:bg-white hover:shadow-lg'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        data-testid="upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          data-testid="file-input"
        />
        
        {/* Icon */}
        <div className={`
          w-24 h-24 mx-auto mb-8 rounded-2xl flex items-center justify-center
          transition-all duration-300
          ${isDragging 
            ? 'bg-orange-500 rotate-6' 
            : darkMode ? 'bg-zinc-700' : 'bg-slate-200'
          }
        `}>
          <Upload className={`w-12 h-12 transition-colors ${
            isDragging 
              ? 'text-white' 
              : darkMode ? 'text-zinc-400' : 'text-slate-500'
          }`} />
        </div>
        
        {/* Text */}
        <p className={`font-heading font-bold text-2xl mb-2 ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>
          {isLoading ? 'Analizando documento...' : 'Arrastra el artículo de estudio en PDF aquí'}
        </p>
        <p className={`text-lg ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
          o haz clic para seleccionar un archivo
        </p>
        
        {/* Features Pills */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${
            darkMode 
              ? 'bg-zinc-700 border-zinc-600' 
              : 'bg-white border-slate-200'
          }`}>
            <Clock className="w-4 h-4 text-orange-500" />
            <span className={`text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-600'}`}>{readingSpeed} palabras/min ({getSpeedLabel(readingSpeed)})</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${
            darkMode 
              ? 'bg-zinc-700 border-zinc-600' 
              : 'bg-white border-slate-200'
          }`}>
            <MessageCircleQuestion className="w-4 h-4 text-orange-500" />
            <span className={`text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-600'}`}>{answerTime} seg/respuesta</span>
          </div>
        </div>
      </div>
    </div>
  );
}
