import {useState} from 'react';
import PuckLegacyStudio from './PuckLegacyStudio';
import PuckConnectedStudio from './PuckConnectedStudio';

/** The real Nesting zone editor is the default; standalone Puck documents stay accessible. */
export default function PuckDesignStudio({onClose}:{onClose:()=>void}){
  const [mode,setMode]=useState<'connected'|'standalone'>('connected');
  return <div className="puck-mode-shell">
    <nav className="puck-mode-switch" aria-label="Puck düzenleyici türü">
      <button type="button" aria-pressed={mode==='connected'} onClick={()=>setMode('connected')}>Gerçek Nesting'i düzenle</button>
      <button type="button" aria-pressed={mode==='standalone'} onClick={()=>setMode('standalone')}>Bağımsız Puck taslağı</button>
      <span>Gerçek Nesting düzeni, sunucu taslağına bağlanır. Bağımsız taslaklar uygulamayı değiştirmez.</span>
    </nav>
    {mode==='connected'?<PuckConnectedStudio onClose={onClose}/>:<PuckLegacyStudio onClose={onClose}/>}
  </div>;
}
