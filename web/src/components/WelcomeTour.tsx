import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useI18n} from '../i18n';
import './WelcomeTour.css';

const steps=[
  {title:"Serula'ya hoş geldiniz",body:'Bu kısa tur, ilk yerleşiminizi hazırlamanıza yardımcı olacak. Dosyanızı ekleyin, malzemenizi tanımlayın, parçaları yerleştirin ve sonucu DXF olarak indirin. İstediğiniz zaman turu atlayabilir, Yardım üzerinden yeniden açabilirsiniz.'},
  {target:'.add-shape',title:'1. Parçalarınızı ekleyin',body:'DXF İçe Aktar ile DXF, SVG veya PLT dosyanızı seçin. Şekil çiz ile de basit bir parça oluşturabilirsiniz. Tur boyunca dosyalarınız ve ayarlarınız değişmez; adımları turdan sonra uygulayabilirsiniz.'},
  {target:'.sidebar',title:'2. Parçaları ve adetleri kontrol edin',body:'Parçalar listesinde şekilleri, ölçüleri ve adetleri görebilirsiniz. Yanındaki sayı, o parçadan kaç kopya yerleştirileceğini belirler. Parçaya tıklayınca özellikleri açılır. Üstteki seri adedi bütün parça adetlerini birlikte çoğaltır.'},
  {target:'.material-settings',title:'3. Rulo veya plaka seçin',body:'Malzeme tipini seçin. Ruloda genişliği, plakada genişlik ve uzunluğu girin. Örneğin 1400 × 670 mm plaka için genişlik 1400, plaka uzunluğu 670 olur. Seçtiğiniz ölçü birimini kontrol edin; gerçek malzeme ölçülerinizi kullanın.'},
  {target:'.material-panel',title:'4. Yerleştirme kurallarını belirleyin',body:'Bir parça seçip izin verilen dönüşleri ayarlayın. Parça aralığı, parçalar arasındaki boşluktur; kesim kerfi değildir. Başlangıç yönünde sağ alt, sağdan sola ilerleyip üst sıraya çıkar; sağ üst, sağdan sola ilerleyip alt sıraya iner.'},
  {target:'.run-controls',title:'5. Yerleştirmeyi başlatın',body:'Parçaları yerleştir düğmesine basın. Sistem malzeme sınırlarını ve parça kurallarını dikkate alarak yerleşim arar. Arama sürerken sonuç iyileşebilir. İstediğiniz zaman Durdur ile mevcut en iyi sonucu koruyabilirsiniz.'},
  {target:'.metrics',title:'6. Sonucu değerlendirin',body:'Alt bölümde kullanılan plaka sayısını veya rulo uzunluğunu, malzeme verimliliğini ve fireyi görebilirsiniz. Çizimi Sığdır ile bütünüyle görün. Ölçüleri ve yerleşimi kontrol ettikten sonra indirme adımına geçin.'},
  {target:'.export-actions',title:'7. DXF olarak indirin',body:'DXF İndir, yerleşimi dışa aktarır. İndirme için oturumunuzun ve kullanım hakkınızın uygun olması gerekir. Önce bir yerleşim hazırlayın. Daha önce indirdiğiniz dosyalara Geçmiş üzerinden ulaşabilir, bu turu Yardım’dan tekrar açabilirsiniz.'},
];
type Box={left:number;top:number;width:number;height:number};
const cacheKey=(id:number)=>`serula-tour-v1:${id}`;

export default function WelcomeTour({userId,blocked=false}:{userId?:number;blocked?:boolean}){
  const {t}=useI18n();
  const [step,setStep]=useState<number|null>(null),[box,setBox]=useState<Box|null>(null);
  const [position,setPosition]=useState<{left:number;top:number}>();
  const dialog=useRef<HTMLDialogElement>(null),card=useRef<HTMLElement>(null),title=useRef<HTMLHeadingElement>(null);
  const seen=useRef(new Set<number>()),returnFocus=useRef<HTMLElement|null>(null),previousScroll=useRef({x:0,y:0});
  const start=()=>{
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    previousScroll.current={x:scrollX,y:scrollY};
    window.dispatchEvent(new Event('serula-tour-prepare'));
    if(userId!==undefined)seen.current.add(userId);
    setStep(0);
  };
  useEffect(()=>{
    window.addEventListener('serula-start-tour',start);
    return()=>window.removeEventListener('serula-start-tour',start);
  },[userId]);
  useEffect(()=>{
    setStep(null);
    if(userId===undefined||seen.current.has(userId))return;
    try{if(localStorage.getItem(cacheKey(userId)))return;}catch{}
    const controller=new AbortController();
    void fetch('/api/onboarding',{credentials:'same-origin',signal:controller.signal}).then(async response=>{
      if(!response.ok)return;
      const data=await response.json();
      if(!controller.signal.aborted&&data.pending===true&&!seen.current.has(userId))start();
    }).catch(()=>{});
    return()=>controller.abort();
  },[userId]);

  const finish=(status:'completed'|'dismissed')=>{
    setStep(null);setBox(null);
    if(userId!==undefined){
      try{localStorage.setItem(cacheKey(userId),status);}catch{}
      void fetch('/api/onboarding',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({status})}).catch(()=>{});
    }
    requestAnimationFrame(()=>{
      window.scrollTo(previousScroll.current.x,previousScroll.current.y);
      const focus=returnFocus.current?.isConnected?returnFocus.current:document.querySelector<HTMLElement>('.panel-title-actions>button');
      focus?.focus({preventScroll:true});
    });
  };
  const open=step!==null&&!blocked;
  useLayoutEffect(()=>{
    if(!open)return;
    const element=dialog.current!;element.showModal();
    return()=>element.close();
  },[open]);
  useLayoutEffect(()=>{
    if(!open||step===null)return;
    const selector=steps[step].target;
    const target=selector?document.querySelector<HTMLElement>(selector):null;
    target?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    title.current?.focus({preventScroll:true});
    const update=()=>{
      const viewport=window.visualViewport;
      const width=viewport?.width??innerWidth,height=viewport?.height??innerHeight;
      const x=viewport?.offsetLeft??0,y=viewport?.offsetTop??0;
      const rect=target?.getBoundingClientRect();
      const next=rect&&rect.width>0&&rect.height>0?{
        left:Math.max(x+6,rect.left-5),top:Math.max(y+6,rect.top-5),
        width:Math.max(0,Math.min(x+width-6,rect.right+5)-Math.max(x+6,rect.left-5)),
        height:Math.max(0,Math.min(y+height-6,rect.bottom+5)-Math.max(y+6,rect.top-5)),
      }:null;
      setBox(next);
      const w=card.current?.offsetWidth??340,h=card.current?.offsetHeight??240,gap=18;
      let left=x+(width-w)/2,top=y+(height-h)/2;
      if(next&&next.width&&next.height){
        if(next.left+next.width+gap+w<x+width-16){left=next.left+next.width+gap;top=next.top;}
        else if(next.left-gap-w>x+16){left=next.left-gap-w;top=next.top;}
        else if(next.top+next.height+gap+h<y+height-16)top=next.top+next.height+gap;
        else if(next.top-gap-h>y+16)top=next.top-gap-h;
        else top=y+height-h-16;
      }
      setPosition({left:Math.max(x+16,Math.min(x+width-w-16,left)),top:Math.max(y+16,Math.min(y+height-h-16,top))});
    };
    update();
    const observer=new ResizeObserver(update);if(target)observer.observe(target);if(card.current)observer.observe(card.current);
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
    return()=>{
      observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);
      window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);
    };
  },[open,step,t]);

  if(!open||step===null)return null;
  const current=steps[step];
  return <dialog ref={dialog} className="welcome-tour" aria-labelledby="tour-title" aria-describedby="tour-description" data-no-i18n onKeyDown={event=>event.stopPropagation()} onCancel={event=>{event.preventDefault();finish('dismissed');}}>
    {box&&box.width>0&&box.height>0?<div className="tour-spotlight" style={box} aria-hidden="true"/>:<div className="tour-shade" aria-hidden="true"/>}
    <section ref={card} className="tour-card" style={position}>
      <div className="tour-top"><span>{t('Tanıtım turu')} · {step+1} / {steps.length}</span><button type="button" className="tour-close" aria-label={t('Turu kapat')} onClick={()=>finish('dismissed')}>×</button></div>
      <progress aria-label={t('Tur ilerlemesi')} value={step+1} max={steps.length}/>
      <h2 id="tour-title" ref={title} tabIndex={-1}>{t(current.title)}</h2>
      <p id="tour-description">{t(current.body)}</p>
      <div className="tour-actions"><button type="button" className="text-button" onClick={()=>finish('dismissed')}>{t('Turu atla')}</button><div>{step>0&&<button type="button" onClick={()=>setStep(step-1)}>{t('Geri')}</button>}<button type="button" className="primary" onClick={()=>step===steps.length-1?finish('completed'):setStep(step+1)}>{t(step===0?'Tura başla':step===steps.length-1?'Tamamla':'İleri')}</button></div></div>
    </section>
  </dialog>;
}
