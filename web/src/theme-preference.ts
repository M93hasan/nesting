import {useEffect,useState} from 'react';

export type ThemePreference='light'|'dark'|'system';
const STORAGE_KEY='serula-theme';

/** Keep the studio's established light default when no preference exists. */
export function readThemePreference():ThemePreference {
  try {
    const saved=localStorage.getItem(STORAGE_KEY);
    return saved==='light'||saved==='dark'||saved==='system'?saved:'light';
  } catch {
    return 'light';
  }
}

export function useThemePreference(){
  const [theme,setTheme]=useState<ThemePreference>(readThemePreference);
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    try { localStorage.setItem(STORAGE_KEY,theme); }
    catch { /* Theme still works when browser storage is unavailable. */ }
  },[theme]);
  return [theme,setTheme] as const;
}
