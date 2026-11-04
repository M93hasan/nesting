import { createRoot } from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import './shadcn-dashboard.css';
import './studio-dashboard.css';
import './slate-ambience.css';
import './compact-workspace.css';






import {AdminGate,UserGate} from './AuthGate';
import {loadCatalog} from './datasets';
import { prepareIsolation } from './isolation';
import {I18nProvider} from './i18n';



const ADMIN_EMAIL='m93hasan@icloud.com';
const GOOGLE_CLIENT_ID='207092733568-2h2751l65c8cbnb3o6qfpvl4uug9f975.apps.googleusercontent.com';

// Remove only obsolete visual-editor drafts from this browser. Do not touch
// any saved Nesting project, account or credit data.
try{
  for(const key of [
    'serula-puck-page-v1',
    'serula-puck-real-nesting-v1',
    'serula-design-studio-draft-v1',
    'serula-design-studio-live-preview-v1'
  ])localStorage.removeItem(key);
}catch{/* Some browsers deny storage access; do not block the application. */}

void prepareIsolation().catch(()=>{}).then(async () => {
  if (import.meta.env.PROD && ['serula.site', 'www.serula.site'].includes(location.hostname)) {
    const beacon = document.createElement('script');
    beacon.type = 'module';
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.dataset.cfBeacon = JSON.stringify({token: '570458f3f91e4805b21cdc84923f0057'});
    document.head.append(beacon);
  }
  const route=location.pathname.replace(/\/$/,'');
  const isAdmin=route==='/admin'||route==='/admin2';
  const mobileAdmin=route==='/admin2';
  createRoot(document.getElementById('root')!).render(<I18nProvider>{isAdmin?<AdminGate><Admin allowedEmail={ADMIN_EMAIL} clientId={GOOGLE_CLIENT_ID} skipAuth mobileMode={mobileAdmin}/></AdminGate>:<UserGate><App/></UserGate>}</I18nProvider>);
  void loadCatalog().catch(()=>{});
});
