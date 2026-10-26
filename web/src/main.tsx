import { createRoot } from 'react-dom/client';
import '../../theme/serula.css';
import App from './App';
import Admin from './Admin';
import {AdminGate,UserGate} from './AuthGate';
import {loadCatalog} from './datasets';
import { prepareIsolation } from './isolation';
import {I18nProvider} from './i18n';

const ADMIN_EMAIL='m93hasan@icloud.com';
const GOOGLE_CLIENT_ID='207092733568-2h2751l65c8cbnb3o6qfpvl4uug9f975.apps.googleusercontent.com';

void prepareIsolation().catch(()=>{}).then(async () => {
  if (import.meta.env.PROD && ['sparrowstudio.app', 'www.sparrowstudio.app'].includes(location.hostname)) {
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
