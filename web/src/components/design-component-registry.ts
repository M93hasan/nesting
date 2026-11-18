/** Safe, explicit editor catalog. No arbitrary React component or executable code is loaded from a draft. */
export const DESIGN_COMPONENTS = [
  {id:'heading',label:'Başlık',parent:null,editable:['heading','fontSize']},
  {id:'panel',label:'Ana panel',parent:null,editable:['panel','radius','spacing']},
  {id:'button',label:'Birincil buton',parent:'panel',editable:['accent','radius']},
] as const;
export type DesignComponentId = typeof DESIGN_COMPONENTS[number]['id'];
export const ROOT_COMPONENTS = DESIGN_COMPONENTS.filter(component=>component.parent===null);
export function isDesignComponentId(value:unknown):value is DesignComponentId {
  return typeof value==='string'&&DESIGN_COMPONENTS.some(item=>item.id===value);
}
export function normalizeRootOrder(value:unknown):DesignComponentId[] {
  const defaults:DesignComponentId[]=ROOT_COMPONENTS.map(component=>component.id);
  if(!Array.isArray(value)||value.length!==defaults.length||!value.every(isDesignComponentId))return defaults;
  if(new Set(value).size!==defaults.length||!value.every(id=>defaults.includes(id)))return defaults;
  return [...value];
}
export function canReorder(source:DesignComponentId,target:DesignComponentId):boolean{
  return source!==target&&ROOT_COMPONENTS.some(item=>item.id===source)&&ROOT_COMPONENTS.some(item=>item.id===target);
}
export function reorderRoot(order:readonly DesignComponentId[],source:DesignComponentId,target:DesignComponentId):DesignComponentId[]{
  const safe=normalizeRootOrder(order);
  if(!canReorder(source,target))return safe;
  const sourceIndex=safe.indexOf(source),targetIndex=safe.indexOf(target);
  const next=safe.filter(id=>id!==source);
  next.splice(next.indexOf(target)+(sourceIndex<targetIndex?1:0),0,source);
  return next;
}
