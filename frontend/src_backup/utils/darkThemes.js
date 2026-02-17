// Dark theme variants configuration
export const darkThemes = {
  zinc: {
    name: 'Zinc',
    description: 'Equilibrado y suave',
    bg: 'bg-zinc-900',
    panel: 'bg-zinc-800',
    panelHover: 'hover:bg-zinc-700',
    border: 'border-zinc-700',
    borderHover: 'hover:border-zinc-600',
    text: 'text-zinc-200',
    textMuted: 'text-zinc-400',
    textSubtle: 'text-zinc-500',
    // Raw colors for inline styles or dynamic usage
    colors: {
      bg: '#18181b',
      panel: '#27272a',
      border: '#3f3f46',
      text: '#e4e4e7',
    }
  },
  amoled: {
    name: 'AMOLED Negro',
    description: 'Negro puro para OLED',
    bg: 'bg-black',
    panel: 'bg-zinc-950',
    panelHover: 'hover:bg-zinc-900',
    border: 'border-zinc-800',
    borderHover: 'hover:border-zinc-700',
    text: 'text-zinc-100',
    textMuted: 'text-zinc-400',
    textSubtle: 'text-zinc-600',
    colors: {
      bg: '#000000',
      panel: '#09090b',
      border: '#27272a',
      text: '#f4f4f5',
    }
  },
  slate: {
    name: 'Slate Oscuro',
    description: 'Tono azulado frío',
    bg: 'bg-slate-900',
    panel: 'bg-slate-800',
    panelHover: 'hover:bg-slate-700',
    border: 'border-slate-700',
    borderHover: 'hover:border-slate-600',
    text: 'text-slate-200',
    textMuted: 'text-slate-400',
    textSubtle: 'text-slate-500',
    colors: {
      bg: '#0f172a',
      panel: '#1e293b',
      border: '#334155',
      text: '#e2e8f0',
    }
  },
  neutral: {
    name: 'Neutral Oscuro',
    description: 'Tono cálido marrón',
    bg: 'bg-neutral-900',
    panel: 'bg-neutral-800',
    panelHover: 'hover:bg-neutral-700',
    border: 'border-neutral-700',
    borderHover: 'hover:border-neutral-600',
    text: 'text-neutral-200',
    textMuted: 'text-neutral-400',
    textSubtle: 'text-neutral-500',
    colors: {
      bg: '#171717',
      panel: '#262626',
      border: '#404040',
      text: '#e5e5e5',
    }
  }
};

// Helper function to get theme classes
export function getThemeClasses(themeKey, darkMode) {
  if (!darkMode) return null;
  return darkThemes[themeKey] || darkThemes.zinc;
}

// Default theme
export const defaultDarkTheme = 'zinc';
