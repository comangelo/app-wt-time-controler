import { BarChart3, Clock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function ParagraphStatsPanel({ paragraphStats, totalParagraphs }) {
  const [isOpen, setIsOpen] = useState(true);
  
  const statsArray = Object.values(paragraphStats);
  const completedCount = statsArray.length;
  
  if (completedCount === 0) return null;
  
  // Calculate totals
  const totalEstimated = statsArray.reduce((sum, s) => sum + s.estimatedTime, 0);
  const totalActual = statsArray.reduce((sum, s) => sum + s.actualTime, 0);
  const totalDifference = totalActual - totalEstimated;
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format difference with sign
  const formatDifference = (diff) => {
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
    return `${sign}${formatTime(Math.abs(diff))}`;
  };

  return (
    <Card className="border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white" data-testid="stats-panel">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-indigo-50/50 transition-colors rounded-t-xl">
            <CardTitle className="font-heading text-sm text-indigo-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Estadísticas de Tiempo
                <Badge variant="outline" className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
                  {completedCount}/{totalParagraphs} párrafos
                </Badge>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-lg border border-indigo-100">
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 uppercase">Estimado</p>
                <p className="text-lg font-mono font-bold text-zinc-700">{formatTime(totalEstimated)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 uppercase">Real</p>
                <p className="text-lg font-mono font-bold text-zinc-700">{formatTime(totalActual)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-zinc-500 uppercase">Diferencia</p>
                <p className={`text-lg font-mono font-bold ${
                  totalDifference > 0 ? 'text-red-600' : totalDifference < 0 ? 'text-green-600' : 'text-zinc-500'
                }`}>
                  {formatDifference(totalDifference)}
                </p>
              </div>
            </div>

            {/* Per-paragraph breakdown */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {statsArray.map((stat, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                    stat.difference > 30 
                      ? 'bg-red-50 border border-red-100' 
                      : stat.difference < -30 
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-zinc-50 border border-zinc-100'
                  }`}
                  data-testid={`stat-row-${stat.paragraphNumber}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-600">P{stat.paragraphNumber}</span>
                    <span className="text-zinc-400">|</span>
                    <span className="text-zinc-500">{stat.wordCount} palabras</span>
                    {stat.questionsCount > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {stat.questionsCount} preg
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-zinc-400 mr-1">Est:</span>
                      <span className="font-mono">{formatTime(stat.estimatedTime)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-400 mr-1">Real:</span>
                      <span className="font-mono">{formatTime(stat.actualTime)}</span>
                    </div>
                    <div className={`flex items-center gap-1 min-w-[60px] justify-end font-mono font-bold ${
                      stat.difference > 0 ? 'text-red-600' : stat.difference < 0 ? 'text-green-600' : 'text-zinc-400'
                    }`}>
                      {stat.difference > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : stat.difference < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <Minus className="w-3 h-3" />
                      )}
                      {formatDifference(stat.difference)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-500 pt-2 border-t border-zinc-100">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-red-500" />
                <span>Más lento</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-green-500" />
                <span>Más rápido</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
