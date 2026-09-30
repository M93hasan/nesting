import { createRoot } from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import './admin.css';
import {loadCatalog} from './datasets';
import { prepareIsolation } from './isolation';

const ADMIN_EMAIL='m93hasan@gmail.com';
const GOOGLE_CLIENT_ID='249559754500-c8sq1giond6vdrab261fkhl7p5f7omvc.apps.googleusercontent.com';

void prepareIsolation().catch(()=>{}).then(async () => {
  if (import.meta.env.PROD && ['sparrowstudio.app', 'www.sparrowstudio.app'].includes(location.hostname)) {
    const beacon = document.createElement('script');
    beacon.type = 'module';
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.dataset.cfBeacon = JSON.stringify({token: '570458f3f91e4805b21cdc84923f0057'});
    document.head.append(beacon);
  }
  const isAdmin=location.pathname.replace(/\/$/,'')==='/admin';
  createRoot(document.getElementById('root')!).render(isAdmin?<Admin allowedEmail={ADMIN_EMAIL} clientId={GOOGLE_CLIENT_ID}/>:<App/>);
  void loadCatalog().catch(()=>{});
});
