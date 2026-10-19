import ButtonStyleEditor from './ButtonStyleEditor';
import {useEffect,useRef,useState} from 'react';
import {DEFAULT_APPEARANCE,useAppearance,type Appearance} from '../appearance';
import {useI18n} from '../i18n';
import './AppearanceSettings.css';

const presets=[
  {name:'Seçtiğin renkler',...DEFAULT_APPEARANCE},
  {name:'Lacivert',background:'#060b24',panel:'#101735'},
  {name:'Antrasit',background:'#151923',panel:'#232a3b'},
];
export default function AppearanceSettings(){
  const {loaded,error,reload}=useAppearance();
  return <section className="admin-card appearance-settings">
    <div className="admin-card-head"><div><h2>Renkleri deneyerek düzenle</h2><p>Koyu tema renklerini seç, sonucu bu ekranda anında gör.</p></div></div>
    {!loaded?<><p role={error?'alert':'status'}>{error||'Renkler yükleniyor…'}</p>{error&&<button onClick={reload}>Yeniden dene</button>}</>:<ColorEditor/>}
  </section>;
}
function ColorEditor(){
  const {appearance,preview,save}=useAppearance(),{t}=useI18n();
  const [draft,setDraft]=useState<Appearance|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [pendingCss,setPendingCss]=useState(false);
  const originalTheme=useRef(document.documentElement.getAttribute('data-theme'));
  const colors=draft??appearance;
  const dirty=colors.background!==appearance.background||colors.panel!==appearance.panel||JSON.stringify(colors.buttons??{})!==JSON.stringify(appearance.buttons??{});
  const restoreTheme=()=>{
    if(originalTheme.current===null)document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme',originalTheme.current);
  };
  useEffect(()=>()=>{
    preview(null);restoreTheme();
  },[preview]);
  const change=(value:Appearance)=>{
    setDraft(value);preview(value);setError('');setNotice('');
    document.documentElement.dataset.theme='dark';
  };
  const revert=()=>{setDraft(null);preview(null);restoreTheme();setError('');setNotice('Kaydedilmiş renklere dönüldü.');};
  const submit=async()=>{
    setBusy(true);setError('');setNotice('');
    try{await save(colors);setDraft(null);setNotice('Görünüm herkes için kaydedildi. Açık ekranlar en geç 30 saniye içinde güncellenir.');}
    catch(reason){setError(reason instanceof Error?reason.message:'Renkler kaydedilemedi.');}
    finally{setBusy(false);}
  };
  return <>
    <p className="appearance-explanation">Deneme sırasında yalnızca senin ekranın değişir. Herkes için kaydet düğmesine basınca renkler tüm kullanıcılara uygulanır.</p>
    <div className="appearance-color-grid">
      <label className="appearance-color"><span>Ana arka plan</span><input type="color" aria-label={t('Ana arka plan')} value={colors.background} disabled={busy} onChange={event=>change({...colors,background:event.target.value})}/><output>{colors.background.toUpperCase()}</output></label>
      <label className="appearance-color"><span>Panel rengi</span><input type="color" aria-label={t('Panel rengi')} value={colors.panel} disabled={busy} onChange={event=>change({...colors,panel:event.target.value})}/><output>{colors.panel.toUpperCase()}</output></label>
    </div>
    <fieldset className="appearance-presets" disabled={busy}><legend>Hazır renkler</legend>{presets.map(({name,...value})=><button key={name} type="button" aria-pressed={colors.background===value.background&&colors.panel===value.panel} onClick={()=>change({...colors,background:value.background,panel:value.panel})}><span className="appearance-swatch" style={{backgroundColor:value.background}} aria-hidden="true"><span style={{backgroundColor:value.panel}}/></span>{t(name)}</button>)}</fieldset>
    <div className="appearance-sample" style={{background:colors.background}} aria-label={t('Renk önizlemesi')}><div style={{background:colors.panel}}><span>Panel önizlemesi</span><p>Yazılar ve düğmeler bu zemin üzerinde görünür.</p><span className="appearance-sample-button">Örnek düğme</span></div></div>
    <ButtonStyleEditor value={colors.buttons??{}} onChange={buttons=>change({...colors,buttons})} disabled={busy} onPending={setPendingCss}/>
    {draft&&<p className="appearance-preview-status" role="status">Canlı önizleme açık. Değişiklikler henüz diğer kullanıcılara uygulanmadı.</p>}
    {error&&<p className="field-error" role="alert">{error}</p>}{notice&&<p className="admin-notice" role="status">{notice}</p>}
    <div className="appearance-actions"><button type="button" disabled={busy||!draft} onClick={revert}>Kaydedilene dön</button><button type="button" className="primary" disabled={busy||!dirty||pendingCss} onClick={()=>void submit()}>{busy?'Kaydediliyor…':'Herkes için kaydet'}</button></div>
  </>;
}
