import { Volume2, VolumeX, Vibrate, Bell, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NotificationSettings({
  soundEnabled,
  setSoundEnabled,
  vibrationEnabled,
  setVibrationEnabled,
  alertTimes,
  setAlertTimes,
  onTestSound,
  onTestVibration,
  overtimeAlertEnabled,
  setOvertimeAlertEnabled,
  darkMode = false,
}) {
  return (
    <Card className={`shadow-sm ${darkMode ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-100'}`} data-testid="notification-settings-card">
      <CardHeader className="pb-2">
        <CardTitle className={`font-heading text-sm flex items-center gap-2 ${darkMode ? 'text-zinc-100' : 'text-zinc-700'}`}>
          <Bell className="w-4 h-4" />
          Configuración de Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-4">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-green-500" />
              ) : (
                <VolumeX className={`w-4 h-4 ${darkMode ? 'text-zinc-400' : 'text-zinc-400'}`} />
              )}
              <Label htmlFor="sound" className={`text-sm ${darkMode ? 'text-zinc-200' : ''}`}>Sonido</Label>
            </div>
            <Switch
              id="sound"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              data-testid="sound-toggle"
            />
          </div>

          {/* Vibration Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Vibrate className={`w-4 h-4 ${vibrationEnabled ? 'text-green-500' : darkMode ? 'text-zinc-400' : 'text-zinc-400'}`} />
              <Label htmlFor="vibration" className={`text-sm ${darkMode ? 'text-zinc-200' : ''}`}>Vibración</Label>
            </div>
            <Switch
              id="vibration"
              checked={vibrationEnabled}
              onCheckedChange={setVibrationEnabled}
              data-testid="vibration-toggle"
            />
          </div>

          {/* Overtime Alert Toggle */}
          <div className={`flex items-center justify-between p-2 rounded-lg ${
            darkMode 
              ? 'bg-orange-900/50 border border-orange-700' 
              : 'bg-orange-50 border border-orange-100'
          }`}>
            <div className="flex items-center gap-2">
              <Timer className={`w-4 h-4 ${overtimeAlertEnabled ? 'text-orange-500' : darkMode ? 'text-zinc-400' : 'text-zinc-400'}`} />
              <div>
                <Label htmlFor="overtime" className={`text-sm ${darkMode ? 'text-zinc-100' : ''}`}>Alerta exceso de tiempo</Label>
                <p className={`text-[10px] ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Avisa si excedes el tiempo del párrafo</p>
              </div>
            </div>
            <Switch
              id="overtime"
              checked={overtimeAlertEnabled}
              onCheckedChange={setOvertimeAlertEnabled}
              data-testid="overtime-alert-toggle"
            />
          </div>

          {/* Alert Times */}
          <div className="space-y-3">
            <Label className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Alertas antes de preguntas de repaso (vacío = desactivado)</Label>
            <div className="flex items-center gap-2">
              <Label className={`text-xs w-20 ${darkMode ? 'text-zinc-300' : ''}`}>1er aviso:</Label>
              <Input
                type="number"
                min="0"
                max="30"
                placeholder="-"
                value={alertTimes.firstAlert || ''}
                onChange={(e) => setAlertTimes(prev => ({ ...prev, firstAlert: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 }))}
                className={`w-16 h-8 text-sm ${darkMode ? 'bg-zinc-700 border-zinc-500 text-zinc-100' : ''}`}
                data-testid="first-alert-input"
              />
              <span className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>min</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className={`text-xs w-20 ${darkMode ? 'text-zinc-300' : ''}`}>2do aviso:</Label>
              <Input
                type="number"
                min="0"
                max="10"
                placeholder="-"
                value={alertTimes.secondAlert || ''}
                onChange={(e) => setAlertTimes(prev => ({ ...prev, secondAlert: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 }))}
                className={`w-16 h-8 text-sm ${darkMode ? 'bg-zinc-700 border-zinc-500 text-zinc-100' : ''}`}
                data-testid="second-alert-input"
              />
              <span className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>min</span>
            </div>
          </div>

          {/* Test Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onTestSound}
              disabled={!soundEnabled}
              className={`flex-1 text-xs ${darkMode ? 'border-zinc-500 text-zinc-200 hover:bg-zinc-700' : ''}`}
              data-testid="test-sound-btn"
            >
              <Volume2 className="w-3 h-3 mr-1" />
              Probar sonido
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onTestVibration}
              disabled={!vibrationEnabled}
              className={`flex-1 text-xs ${darkMode ? 'border-zinc-500 text-zinc-200 hover:bg-zinc-700' : ''}`}
              data-testid="test-vibration-btn"
            >
              <Vibrate className="w-3 h-3 mr-1" />
              Probar vibración
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
