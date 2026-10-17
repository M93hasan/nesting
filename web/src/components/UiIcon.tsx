type IconName='overview'|'users'|'messages'|'roles'|'user-settings'|'defaults'|'history'|'logs'|'system'|'contact';

const paths:Record<IconName,string>={
  overview:'m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
  users:'M15 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M17 4a4 4 0 0 1 0 8m4 8v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  messages:'M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5',
  roles:'m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Zm-4 9 3 3 5-6',
  'user-settings':'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6',
  defaults:'M4 4h16v16H4V4Zm0 6h16M10 10v10',
  history:'M3 11a9 9 0 1 1 2.4 7.1M3 4v7h7m2-5v6l4 2',
  logs:'M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4',
  system:'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  contact:'M7 3H3c0 10 8 18 18 18v-4l-5-2-2 3a16 16 0 0 1-8-8l3-2-2-5Z',
};

export default function UiIcon({name}:{name:IconName}){
  return <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
