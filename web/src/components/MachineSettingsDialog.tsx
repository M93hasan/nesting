import {useEffect,useState,type FormEvent} from 'react';
import Modal from './Modal';
import type {MachineProfile} from '../geometry/headMode';
import {checkMachineProfile} from '../geometry/headMode';

export default function MachineSettingsDialog({profile,onSave,onClose,required=false,busy=false,serverError=''}:{
  profile:MachineProfile;onSave:(profile:MachineProfile)=>Promise<void>;
  onClose:()=>void;required?:boolean;busy?:boolean;serverError?:string
}){
  const [draft,setDraft]=useState<MachineProfile>(profile);
  const [error,setError]=useState('');
  useEffect(()=>{setDraft(profile);setError('');},[profile]);
  const save=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const validation=checkMachineProfile(draft);
    if(validation){setError(validation);return;}
    setError('');
    void onSave(draft);
  };
  const half=draft.physicalWidthMm/(draft.headMode==='dual'?2:1);
  return <Modal title={required?'İlk kurulum · Makinenizi tanıyalım':'Ayarlarım · Makine ve kesim alanı'}
    onClose={onClose} locked={required||busy} className="machine-settings-dialog">
    <form onSubmit={save} className="machine-settings-form">
      <p>{required?'Bu bilgiler hesabınıza kaydedilir ve her girişte otomatik uygulanır.':'Kaydettiğiniz makine ayarları kullanıcı hesabınıza özel saklanır.'}</p>
      <label>Makine kafası
        <select value={draft.headMode} disabled={busy}
          onChange={e=>setDraft(p=>({...p,headMode:e.target.value as MachineProfile['headMode']}))}>
          <option value="single">Tek kafa</option><option value="dual">Çift kafa (eş zamanlı)</option>
        </select>
      </label>
      <label>Malzeme biçimi
        <select value={draft.materialType} disabled={busy}
          onChange={e=>setDraft(p=>({...p,materialType:e.target.value as MachineProfile['materialType']}))}>
          <option value="sheet">Plaka</option><option value="roll">Rulo</option>
        </select>
      </label>
      <label>Makinenin gerçek kesim eni (mm)
        <input type="number" min="0.001" max="100000" step="any" required
          value={draft.physicalWidthMm} disabled={busy}
          onChange={e=>setDraft(p=>({...p,physicalWidthMm:e.target.valueAsNumber}))}/>
      </label>
      {draft.materialType==='sheet'&&<label>Makinenin kesim boyu / plaka uzunluğu (mm)
        <input type="number" min="0.001" max="100000" step="any" required disabled={busy}
          value={draft.materialLengthMm??1000}
          onChange={e=>setDraft(p=>({...p,materialLengthMm:e.target.valueAsNumber}))}/>
      </label>}
      <p className="muted">Nesting için kullanılan en: <strong>{Number.isFinite(half)?half.toLocaleString('tr-TR'):'—'} mm</strong>
        {draft.headMode==='dual'&&<> · Gerçek kesim eni iki eşit çalışma bölgesine ayrılır. DXF'ye ikinci kopya eklenmez; ikinci kafa X ofsetini makinede doğrulayın.</>}
      </p>
      {(error||serverError)&&<p role="alert" className="field-error">{error||serverError}</p>}
      <div className="modal-actions">
        {!required&&<button type="button" disabled={busy} onClick={onClose}>Vazgeç</button>}
        <button type="submit" className="primary" disabled={busy}>{busy?'Kaydediliyor…':'Ayarlarımı kaydet'}</button>
      </div>
    </form>
  </Modal>;
}
