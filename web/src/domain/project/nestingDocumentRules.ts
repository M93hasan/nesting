import type { Document } from '../../model';
import { validQuantity, validRotationRule } from './editorRules';

/** The existing manufacturing/editor limits, extracted without changing units. */
export function hasInvalidNestingSettings(doc: Document, sizeValid: boolean): boolean {
  return !sizeValid||!Number.isFinite(doc.settings.materialWidthMm)||doc.settings.materialWidthMm<=0||doc.settings.materialWidthMm>100_000||((doc.settings.materialType??'roll')==='sheet'&&(!Number.isFinite(doc.settings.materialLengthMm)||doc.settings.materialLengthMm!<=0||doc.settings.materialLengthMm!>100_000))||!Number.isFinite(doc.settings.clearanceMm)||doc.settings.clearanceMm<0||doc.settings.clearanceMm>=doc.settings.materialWidthMm||doc.parts.some(p=>!validQuantity(p.quantity)||(p.quantity>0&&!validRotationRule(p.rotations)))||doc.parts.reduce((n,p)=>n+p.quantity,0)>500;
}

/** Editing a copy count starts a new single-series quantity baseline. */
export function reconcileExpandedSeries(doc: Document, next: Document): Document {
  const quantitiesChanged=next.parts.length!==doc.parts.length
    ||next.parts.some(part=>doc.parts.find(old=>old.id===part.id)?.quantity!==part.quantity);
  if(doc.seriesCountMode==='expanded'&&String(doc.seriesMultiplier??1)!=='1'
    &&next.seriesCountMode==='expanded'
    &&String(next.seriesMultiplier??1)===String(doc.seriesMultiplier??1)
    &&quantitiesChanged)
    return {...next,seriesMultiplier:undefined};
  return next;
}
