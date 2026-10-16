import type {Document,Settings} from '../model';

export type MachineProfile={headMode:'single'|'dual';materialType:'roll'|'sheet';physicalWidthMm:number;materialLengthMm?:number};

/** Legacy 0.1.15 dual-head files stored half of the physical width.
 * New files store the entered width directly, regardless of head count. */
export function physicalMaterialWidthMm(settings:Settings):number {
  return settings.headMode==='dual'&&settings.widthMode!=='full'
    ? settings.materialWidthMm*2 : settings.materialWidthMm;
}

/** Idempotently migrate old dual-head projects without moving or scaling DXF parts. */
export function upgradeLegacyDualHeadDocument(doc:Document):Document {
  const settings=doc.settings;
  if(settings.headMode!=='dual'||settings.widthMode==='full')return doc;
  return {...doc,settings:{...settings,materialWidthMm:physicalMaterialWidthMm(settings),
    widthMode:'full'}};
}

export function setPhysicalMaterialWidth(settings:Settings,width:number):Settings {
  return {...settings,materialWidthMm:width,widthMode:'full'};
}
export function setHeadMode(settings:Settings,mode:MachineProfile['headMode']):Settings {
  return {...settings,headMode:mode,materialWidthMm:physicalMaterialWidthMm(settings),widthMode:'full'};
}
export function machineProfileFromSettings(settings:Settings):MachineProfile {
  return {headMode:settings.headMode??'single',materialType:settings.materialType??'roll',
    physicalWidthMm:physicalMaterialWidthMm(settings),
    ...(settings.materialType==='sheet'?{materialLengthMm:settings.materialLengthMm}: {})};
}
export function checkMachineProfile(p:MachineProfile):string|null {
  if(!p||!['single','dual'].includes(p.headMode)||!['roll','sheet'].includes(p.materialType))
    return 'Makine kafa sayısı veya malzeme türü geçersiz.';
  if(!Number.isFinite(p.physicalWidthMm)||p.physicalWidthMm<=0||p.physicalWidthMm>100000)
    return 'Makinenin gerçek kesim eni 0–100.000 mm aralığında olmalıdır.';
  if(p.materialType==='sheet'&&(!Number.isFinite(p.materialLengthMm)||p.materialLengthMm!<=0||p.materialLengthMm!>100000))
    return 'Plakanın kesim boyunu girin.';
  return null;
}
export function applyMachineProfile(doc:Document,p:MachineProfile):Document {
  const error=checkMachineProfile(p);
  if(error)throw Error(error);
  return {...doc,settings:{...doc.settings,headMode:p.headMode,materialType:p.materialType,
    materialWidthMm:p.physicalWidthMm,widthMode:'full',
    materialLengthMm:p.materialType==='sheet'?p.materialLengthMm:undefined}};
}
