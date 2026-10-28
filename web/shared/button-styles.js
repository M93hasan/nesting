// Shared by the browser and API: declarations only, never arbitrary selectors or URLs.
export const BUTTON_TARGETS = [
  ['place','Kullanıcı · Parçaları yerleştir','.reference-launch'],
  ['stop','Kullanıcı · Durdur','.stop-button'],
  ['compress','Kullanıcı · Sıkıştırmaya geç','.skip-compression'],
  ['corel','Kullanıcı · CorelDRAW aktar','.corel-transfer-button'],
  ['download','Kullanıcı · DXF indir','.download-control .download-button'],
  ['import','Kullanıcı · DXF içe aktar','[data-button-style="import"]'],
  ['shape','Kullanıcı · Şekil çiz','[data-button-style="shape"]'],
  ['undo','Kullanıcı · Geri al','[data-button-style="undo"]'],
  ['redo','Kullanıcı · Yinele','[data-button-style="redo"]'],
  ['clear','Kullanıcı · Tümünü sil','.clear-all-parts'],
  ['history','Kullanıcı · Geçmiş','.history-tab'],
  ['test','Kullanıcı · Test DXF','.test-dxf-tab'],
  ['theme','Kullanıcı · Açık/koyu görünüm','.theme-toggle'],
  ['contact','Kullanıcı · İletişim','.hello-button'],
  ['admin-corel','Admin · CorelDRAW yetkisi','.corel-transfer-toggle'],
  ['admin-screen','Admin · Ekrana bağlan','.admin-user-actions .screen-support-button'],
  ['admin-delete','Admin · Kullanıcıyı sil','.admin-user-actions .danger-button'],
  ...['overview','users','messages','roles','user-settings','defaults','appearance','history','logs','system'].map((id,i)=>['nav-'+id,'Admin menü · '+['Genel bakış','Kullanıcılar','Mesajlar','Roller','Kullanıcı ayarları','Varsayılanlar','Görünüm','Geçmiş','Loglar','Sistem'][i],'[data-button-style="nav-'+id+'"]'])
];
const properties = new Set('color background background-color background-image border border-color border-width border-style border-radius box-shadow padding padding-inline padding-block font-size font-weight letter-spacing line-height opacity text-transform text-shadow'.split(' '));
export function validateButtonCss(css) {
  if(typeof css!=='string'||css.length>2000)throw Error('CSS en fazla 2000 karakter olabilir.');
  if(/[{}@<>\\]/.test(css)||/url\s*\(|expression\s*\(|var\s*\(|\/\*/i.test(css))throw Error('Yalnızca stil özellikleri yazın; seçici, URL ve CSS değişkeni kullanmayın.');
  for(const declaration of css.split(';')) {
    if(!declaration.trim())continue;
    const colon=declaration.indexOf(':');
    const property=declaration.slice(0,colon).trim().toLowerCase();
    const value=declaration.slice(colon+1).trim();
    if(colon<1||!properties.has(property)||!value||!/^[a-z0-9#%.,() +!\-]+$/i.test(value))throw Error('Desteklenmeyen veya geçersiz CSS özelliği: '+property);
  }
  return css.trim();
}
export function parseButtonStyles(value) {
  if(value===undefined)return {};
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>BUTTON_TARGETS.length)throw Error('Geçersiz buton ayarları.');
  const result={};
  for(const [id,states] of Object.entries(value)) {
    if(!BUTTON_TARGETS.some(target=>target[0]===id)||!states||typeof states!=='object'||Array.isArray(states))throw Error('Geçersiz buton.');
    const clean={};
    for(const [state,css] of Object.entries(states)) {
      if(!['normal','hover','disabled'].includes(state))throw Error('Geçersiz buton durumu.');
      const valid=validateButtonCss(css);if(valid)clean[state]=valid;
    }
    if(Object.keys(clean).length)result[id]=clean;
  }
  return result;
}
export function buttonStylesheet(styles) {
  return BUTTON_TARGETS.flatMap(([id,,selector])=>Object.entries(styles?.[id]||{}).map(([state,css])=>{
    // Geometry is shared by every button; keep saved color/state overrides intact.
    const declarations=validateButtonCss(css).split(';').filter(s=>s.trim()&&!/^\s*border-radius\s*:/i.test(s)).map(s=>s.replace(/\s*!important\s*$/i,'')+' !important').join(';');
    const suffix=state==='hover'?':hover:not(:disabled)':state==='disabled'?':disabled':'';
    return ':root #root '+selector+suffix+'{'+declarations+'}';
  })).join('\n');
}


const CUSTOM_CSS_PROPERTIES = new Set((
  'color background background-color background-image background-size border border-color border-width border-style border-radius box-shadow padding padding-inline padding-block margin margin-inline margin-block width min-width max-width height min-height max-height font-size font-weight font-family letter-spacing line-height opacity text-transform text-shadow position overflow overflow-x overflow-y cursor display align-items justify-content gap transform transform-origin transition z-index top right bottom left content pointer-events outline outline-color outline-width outline-style outline-offset flex flex-grow flex-shrink flex-basis box-sizing white-space text-align appearance vertical-align user-select visibility aspect-ratio'
).split(/\s+/));

const CUSTOM_CSS_ANIMATION_PROPERTIES = new Set('animation animation-name animation-duration animation-delay animation-timing-function animation-iteration-count animation-direction animation-fill-mode animation-play-state'.split(' '));
function validateDeclarations(declarations, allowAnimation = false) {
  for (const declaration of declarations.split(';')) {
    if (!declaration.trim()) continue;
    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (colon < 1 || !(CUSTOM_CSS_PROPERTIES.has(property) || (allowAnimation && CUSTOM_CSS_ANIMATION_PROPERTIES.has(property))) || !value || !/^[a-z0-9#%.,() _"'!+\/-]+$/i.test(value)) {
      throw Error('Desteklenmeyen veya geçersiz CSS özelliği: ' + property);
    }
  }
}
export function validateCustomCss(css) {
  if (typeof css !== 'string' || css.length > 10000) throw Error('Özel CSS en fazla 10000 karakter olabilir.');
  if (!css.trim()) return '';
  if (/url\s*\(|expression\s*\(|var\s*\(|javascript:|\\|<|>|@import|@charset|@font-face|@media|@supports/i.test(css)) {
    throw Error('Yalnızca güvenli seçiciler ve @keyframes animasyonları kullanılabilir; URL, CSS değişkeni ve diğer @ kuralları desteklenmez.');
  }
  const rules = [];
  let consumed = '';
  const pattern = /(@keyframes\s+[a-zA-Z_][a-zA-Z0-9_-]*\s*\{(?:[^{}]*\{[^{}]*\}\s*)+\}|[^{}]+\{[^{}]*\})/g;
  let match;
  while ((match = pattern.exec(css)) !== null) {
    const rule = match[0];
    const keyframes = rule.match(/^@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*\{([\s\S]*)\}$/);
    if (keyframes) {
      const framePattern = /([^{}]+)\{([^{}]*)\}/g;
      let frame, frameConsumed = '';
      while ((frame = framePattern.exec(keyframes[2])) !== null) {
        const steps = frame[1].trim().split(',').map(step => step.trim());
        if (!steps.length || steps.some(step => !/^(from|to|(?:100|[0-9]{1,2})(?:\.[0-9]+)?%)$/i.test(step))) throw Error('Animasyon adımları from, to veya yüzde olmalıdır.');
        validateDeclarations(frame[2], true);
        frameConsumed += frame[0];
      }
      if (keyframes[2].replace(/\s/g, '') !== frameConsumed.replace(/\s/g, '')) throw Error('@keyframes sözdizimi hatalı.');
      rules.push(rule);
    } else {
      const ordinary = rule.match(/^([^{}]+)\{([^{}]*)\}$/);
      const selectorText = ordinary[1].trim(), declarations = ordinary[2].trim();
      if (!selectorText || !declarations) throw Error('CSS kuralı boş olamaz.');
      for (const selector of selectorText.split(',').map(s => s.trim())) {
        if (!(selector.startsWith('.') || selector.startsWith('#') || selector.startsWith('[')) || !/^[.a-zA-Z0-9_#:\[\]=\"'()\-\s>+~,:*]+$/.test(selector)) throw Error('Güvenlik için seçiciler .class, #id veya [attribute] ile başlamalıdır.');
      }
      validateDeclarations(declarations, true);
      rules.push(selectorText + '{' + declarations + '}');
    }
    consumed += rule;
  }
  if (css.replace(/\s/g, '') !== consumed.replace(/\s/g, '')) throw Error('CSS sözdizimi hatalı. Her seçici için { ... } kullanın.');
  return rules.join('\n');
}
export function customCssStylesheet(css) {
  let valid = '';
  try { valid = validateCustomCss(css || ''); } catch { return ''; }
  return valid.replace(/(@keyframes\s+[a-zA-Z_][a-zA-Z0-9_-]*\s*\{(?:[^{}]*\{[^{}]*\}\s*)+\}|([^{}]+)\{([^{}]*)\})/g, (rule, keyframes, selectors, declarations) => {
    if (rule.startsWith('@keyframes')) return rule;
    return selectors.split(',').map(selector => {
      const trimmed = selector.trim();
      return (trimmed.startsWith('.app') ? trimmed : '.app ' + trimmed) + '{' + declarations + '}';
    }).join('\n');
  });
}
