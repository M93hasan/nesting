export type AppLanguage='tr'|'en'|'ar'|'fa';

export const SUPPORTED_LANGUAGES:{code:AppLanguage;nativeLabel:string;dir:'ltr'|'rtl'}[]=[
  {code:'tr',nativeLabel:'Türkçe',dir:'ltr'},
  {code:'en',nativeLabel:'English',dir:'ltr'},
  {code:'ar',nativeLabel:'العربية',dir:'rtl'},
  {code:'fa',nativeLabel:'فارسی',dir:'rtl'}
];

const STORAGE_KEY='serula-language';
let currentLanguage:AppLanguage='tr';

const words:Record<string,Partial<Record<AppLanguage,string>>>={
  'Giriş yap':{en:'Sign in',ar:'تسجيل الدخول',fa:'ورود'},
  'Kayıt ol':{en:'Register',ar:'إنشاء حساب',fa:'ثبت‌نام'},
  'Hesap oluştur':{en:'Create account',ar:'إنشاء الحساب',fa:'ایجاد حساب'},
  'Adınız':{en:'Your name',ar:'الاسم',fa:'نام شما'},
  'E-posta':{en:'Email',ar:'البريد الإلكتروني',fa:'ایمیل'},
  'Parola':{en:'Password',ar:'كلمة المرور',fa:'رمز عبور'},
  'Yeni parola':{en:'New password',ar:'كلمة مرور جديدة',fa:'رمز عبور جدید'},
  'Parolayı değiştir':{en:'Change password',ar:'تغيير كلمة المرور',fa:'تغییر رمز عبور'},
  'Bekleyin…':{en:'Please wait…',ar:'يرجى الانتظار…',fa:'لطفاً صبر کنید…'},
  'Şimdilik kapat':{en:'Close for now',ar:'إغلاق الآن',fa:'فعلاً ببند'},
  'Kullanıcı':{en:'User',ar:'المستخدم',fa:'کاربر'},
  'Çıkış yap':{en:'Sign out',ar:'تسجيل الخروج',fa:'خروج'},
  'Sınırsız kullanım':{en:'Unlimited use',ar:'استخدام غير محدود',fa:'استفاده نامحدود'},
  'Lisans: süresiz':{en:'License: unlimited',ar:'الترخيص: غير محدود',fa:'مجوز: بدون محدودیت'},
  'Lisans süresi doldu':{en:'License expired',ar:'انتهت صلاحية الترخيص',fa:'اعتبار مجوز تمام شده'},
  'Dil':{en:'Language',ar:'اللغة',fa:'زبان'},
  'Varsayılan dil':{en:'Default language',ar:'اللغة الافتراضية',fa:'زبان پیش‌فرض'},
  'Yeni proje':{en:'New project',ar:'مشروع جديد',fa:'پروژه جدید'},
  'Proje aç':{en:'Open project',ar:'فتح المشروع',fa:'باز کردن پروژه'},
  'Proje oluştur':{en:'Create project',ar:'إنشاء مشروع',fa:'ایجاد پروژه'},
  'Projeyi yeniden adlandır':{en:'Rename project',ar:'إعادة تسمية المشروع',fa:'تغییر نام پروژه'},
  'Yeniden adlandır':{en:'Rename',ar:'إعادة تسمية',fa:'تغییر نام'},
  'Parçalar':{en:'Parts',ar:'القطع',fa:'قطعات'},
  'Parça özellikleri':{en:'Part properties',ar:'خصائص القطعة',fa:'ویژگی‌های قطعه'},
  'Malzeme ve Yerleşim':{en:'Material & Nesting',ar:'الخامة والتعشيق',fa:'متریال و چیدمان'},
  'Malzeme ölçüsü':{en:'Material size',ar:'مقاس الخامة',fa:'ابعاد متریال'},
  'Genişlik':{en:'Width',ar:'العرض',fa:'عرض'},
  'Yükseklik':{en:'Height',ar:'الارتفاع',fa:'ارتفاع'},
  'Rulo':{en:'Roll',ar:'لفة',fa:'رول'},
  'Plaka':{en:'Sheet',ar:'لوح',fa:'ورق'},
  'İzin verilen dönüşler':{en:'Allowed rotations',ar:'الدورانات المسموحة',fa:'چرخش‌های مجاز'},
  'Serbest dönüş':{en:'Free rotation',ar:'دوران حر',fa:'چرخش آزاد'},
  'Parçaları yerleştir':{en:'Nest parts',ar:'تعشيق القطع',fa:'چیدمان قطعات'},
  'Yeniden yerleştir':{en:'Nest again',ar:'إعادة التعشيق',fa:'چیدمان دوباره'},
  'Önizlemeyi güncelle':{en:'Update preview',ar:'تحديث المعاينة',fa:'به‌روزرسانی پیش‌نمایش'},
  'Şekil ekle':{en:'Add shape',ar:'إضافة شكل',fa:'افزودن شکل'},
  'Şekil kütüphanesi':{en:'Shape library',ar:'مكتبة الأشكال',fa:'کتابخانه اشکال'},
  'Geçmiş':{en:'History',ar:'السجل',fa:'تاریخچه'},
  'İletişim':{en:'Contact',ar:'التواصل',fa:'ارتباط'},
  'Gönder':{en:'Send',ar:'إرسال',fa:'ارسال'},
  'Gönderiliyor…':{en:'Sending…',ar:'جارٍ الإرسال…',fa:'در حال ارسال…'},
  'Mesajınızı yazın…':{en:'Write your message…',ar:'اكتب رسالتك…',fa:'پیام خود را بنویسید…'},
  'Yükleniyor…':{en:'Loading…',ar:'جارٍ التحميل…',fa:'در حال بارگذاری…'},
  'Yakınlaştır':{en:'Zoom in',ar:'تكبير',fa:'بزرگ‌نمایی'},
  'Uzaklaştır':{en:'Zoom out',ar:'تصغير',fa:'کوچک‌نمایی'},
  'Sil':{en:'Delete',ar:'حذف',fa:'حذف'},
  'Kaydet':{en:'Save',ar:'حفظ',fa:'ذخیره'},
  'Bitir':{en:'End',ar:'إنهاء',fa:'پایان'},
  'Reddet':{en:'Decline',ar:'رفض',fa:'رد'},
  'Onayla':{en:'Approve',ar:'موافقة',fa:'تأیید'},
  'Hesap menüsü':{en:'Account menu',ar:'قائمة الحساب',fa:'منوی حساب'}
};

const originalText=new WeakMap<Text,string>();
const originalAttrs=new WeakMap<Element,Map<string,string>>();
let observer:MutationObserver|undefined;

export function normalizeLanguage(value:unknown):AppLanguage{
  const valueCode=String(value||'').toLowerCase().split('-')[0];
  if(valueCode==='en'||valueCode==='ar'||valueCode==='fa'||valueCode==='tr')return valueCode;
  return 'tr';
}
export function languageDirection(language:AppLanguage){return language==='ar'||language==='fa'?'rtl':'ltr'}
export function initialLanguage():AppLanguage{
  try{const saved=localStorage.getItem(STORAGE_KEY);if(saved)return normalizeLanguage(saved)}catch{}
  return normalizeLanguage(navigator.language);
}
function translateValue(source:string,language:AppLanguage){
  if(language==='tr')return source;
  const trimmed=source.trim(),translated=words[trimmed]?.[language];
  if(!translated)return source;
  const start=source.indexOf(trimmed);
  return source.slice(0,start)+translated+source.slice(start+trimmed.length);
}
function translateElement(el:Element){
  let map=originalAttrs.get(el);if(!map){map=new Map();originalAttrs.set(el,map)}
  for(const attr of ['placeholder','title','aria-label']){
    if(!el.hasAttribute(attr))continue;
    if(!map.has(attr))map.set(attr,el.getAttribute(attr)||'');
    el.setAttribute(attr,translateValue(map.get(attr)||'',currentLanguage));
  }
}
function walk(root:Node){
  if(root.nodeType===Node.TEXT_NODE){
    const text=root as Text;if(!originalText.has(text))originalText.set(text,text.nodeValue||'');
    text.nodeValue=translateValue(originalText.get(text)||'',currentLanguage);return;
  }
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE)translateElement(root as Element);
  for(const child of Array.from(root.childNodes))walk(child);
}
export function applyLanguage(language:AppLanguage,{persist=true}={}){
  currentLanguage=normalizeLanguage(language);
  const dir=languageDirection(currentLanguage);
  document.documentElement.lang=currentLanguage;document.documentElement.dir=dir;
  if(document.body)document.body.dir=dir;
  if(persist){try{localStorage.setItem(STORAGE_KEY,currentLanguage)}catch{}}
  if(document.body)walk(document.body);
  window.dispatchEvent(new CustomEvent('serula-language-changed',{detail:{language:currentLanguage}}));
}
export function getCurrentLanguage(){return currentLanguage}
export function startI18n(){
  applyLanguage(initialLanguage());
  if(observer)return;
  observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')walk(record.target);for(const node of Array.from(record.addedNodes))walk(node);if(record.type==='attributes'&&record.target instanceof Element)translateElement(record.target)}});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
}
