import { Clock, MessageCircleQuestion, Settings, Timer, Mic, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

export function SettingsPanel({ 
  readingSpeed, 
  setReadingSpeed, 
  answerTime, 
  setAnswerTime,
  totalDuration,
  setTotalDuration,
  introductionDuration,
  setIntroductionDuration,
  closingWordsDuration,
  setClosingWordsDuration,
  darkMode = false
}) {
  const speedOptions = [
    { value: 150, label: "Lento", description: "150 PPM" },
    { value: 180, label: "Normal", description: "180 PPM" },
    { value: 210, label: "Rápido", description: "210 PPM" }
  ];

  return (
    <Card className={`mb-4 sm:mb-8 shadow-sm transition-colors duration-300 ${
      darkMode 
        ? 'bg-zinc-800 border-zinc-700' 
        : 'bg-white border-slate-200'
    }`}>
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3 sm:mb-4 md:mb-6">
          <Settings className={`w-4 h-4 sm:w-5 sm:h-5 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`} />
          <h3 className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>Configuración de tiempos</h3>
        </div>
        
        {/* Primera fila: Duración, Velocidad, Respuesta */}
        <div className="grid grid-cols-1 landscape:grid-cols-3 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-4 sm:mb-6">
          {/* Duración total - Slider */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-700'}`}>Duración Total</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-orange-500" style={{ fontFamily: 'system-ui' }}>
                {totalDuration} min
              </span>
            </div>
            <Slider
              value={[totalDuration]}
              onValueChange={(value) => setTotalDuration(value[0])}
              min={0}
              max={60}
              step={1}
              className="w-full"
              data-testid="duration-slider"
            />
            <div className={`flex justify-between text-[10px] sm:text-xs mt-1.5 sm:mt-2 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
              <span>0</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Velocidad de lectura */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
              <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-700'}`}>Velocidad</span>
            </div>
            <div className="flex gap-1.5 sm:gap-2">
              {speedOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setReadingSpeed(option.value)}
                  className={`flex-1 py-1.5 sm:py-2 md:py-3 px-1 sm:px-2 md:px-4 rounded-lg sm:rounded-xl text-center transition-all ${
                    readingSpeed === option.value
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                      : darkMode 
                        ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid={`speed-${option.value}`}
                >
                  <span className="block text-[10px] sm:text-xs md:text-sm font-semibold">{option.label}</span>
                  <span className={`block text-[8px] sm:text-[10px] md:text-xs mt-0.5 ${
                    readingSpeed === option.value 
                      ? 'text-orange-100' 
                      : darkMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Tiempo por respuesta */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <MessageCircleQuestion className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-700'}`}>Respuesta</span>
              </div>
              <span className="text-sm sm:text-base md:text-lg font-bold text-orange-500" style={{ fontFamily: 'system-ui' }}>
                {answerTime} seg
              </span>
            </div>
            <Slider
              value={[answerTime]}
              onValueChange={(value) => setAnswerTime(value[0])}
              min={15}
              max={90}
              step={5}
              className="w-full"
              data-testid="answer-time-slider"
            />
            <div className={`flex justify-between text-[10px] sm:text-xs mt-1.5 sm:mt-2 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
              <span>15</span>
              <span>90 seg</span>
            </div>
          </div>
        </div>

        {/* Segunda fila: Introducción y Conclusión */}
        <div className={`pt-4 sm:pt-6 border-t ${darkMode ? 'border-zinc-700' : 'border-slate-200'}`}>
          <p className={`text-xs sm:text-sm font-medium mb-3 sm:mb-4 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
            Tiempos del conductor
          </p>
          <div className="grid grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            {/* Tiempo de Introducción */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                  <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-700'}`}>Introducción</span>
                </div>
                <span className="text-sm sm:text-base md:text-lg font-bold text-blue-500" style={{ fontFamily: 'system-ui' }}>
                  {introductionDuration} seg
                </span>
              </div>
              <Slider
                value={[introductionDuration]}
                onValueChange={(value) => setIntroductionDuration(value[0])}
                min={30}
                max={180}
                step={10}
                className="w-full [&_[role=slider]]:bg-blue-500"
                data-testid="introduction-time-slider"
              />
              <div className={`flex justify-between text-[10px] sm:text-xs mt-1.5 sm:mt-2 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                <span>30 seg</span>
                <span>3 min</span>
              </div>
            </div>

            {/* Tiempo de Conclusión */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
                  <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-zinc-300' : 'text-slate-700'}`}>Conclusión</span>
                </div>
                <span className="text-sm sm:text-base md:text-lg font-bold text-purple-500" style={{ fontFamily: 'system-ui' }}>
                  {closingWordsDuration} seg
                </span>
              </div>
              <Slider
                value={[closingWordsDuration]}
                onValueChange={(value) => setClosingWordsDuration(value[0])}
                min={30}
                max={180}
                step={10}
                className="w-full [&_[role=slider]]:bg-purple-500"
                data-testid="closing-time-slider"
              />
              <div className={`flex justify-between text-[10px] sm:text-xs mt-1.5 sm:mt-2 ${darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                <span>30 seg</span>
                <span>3 min</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
