// Format seconds to MM:SS or HH:MM:SS
export const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Format seconds to readable text (simplified for display)
export const formatTimeText = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  // Less than 60 seconds - show only seconds
  if (mins === 0) return `${secs} seg`;
  
  // 60 seconds or more - show in minutes (rounded or with seconds)
  if (secs === 0) return `${mins} min`;
  
  // Show minutes and seconds
  return `${mins} min ${secs} seg`;
};

// Format seconds to compact text (for cards - shows only minutes if >= 60s)
export const formatTimeCompact = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  // Less than 60 seconds - show only seconds
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  
  // 60 seconds or more - show in minutes with decimal if needed
  const totalMins = seconds / 60;
  if (secs === 0) return `${mins} min`;
  
  // Round to 1 decimal for cleaner display
  return `${totalMins.toFixed(1)} min`;
};

// Format time as HH:MM (clock format)
export const formatClockTime = (date) => {
  if (!date) return "--:--";
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

// Add seconds to a date and return new date
export const addSecondsToDate = (date, seconds) => {
  if (!date) return null;
  return new Date(date.getTime() + seconds * 1000);
};
