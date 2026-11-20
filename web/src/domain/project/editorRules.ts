import type { Part, RotationRule } from '../../model';

/** Shared editor rules: independent of React, storage and Worker transports. */
export const DEFAULT_ROTATIONS:RotationRule={kind:'discrete',degrees:[0,180]};
export const validRotationRule=(rule:RotationRule|undefined)=>!!rule&&(rule.kind==='continuous'||(rule.kind==='discrete'&&Array.isArray(rule.degrees)&&rule.degrees.length>0&&rule.degrees.every(Number.isFinite)));
export const normalizedRotationRule=(rule:RotationRule|undefined):RotationRule=>validRotationRule(rule)?rule!:DEFAULT_ROTATIONS;
export const rotationValue=(rule:RotationRule|undefined)=>!validRotationRule(rule)?'invalid':rule!.kind==='continuous'?'free':JSON.stringify([...new Set(rule!.degrees.map(d=>((d%360)+360)%360))].sort((a,b)=>a-b));
export const validQuantity=(n:number)=>Number.isInteger(n)&&n>=0&&n<=500;
export const displayedPieceCount=(parts:Part[])=>parts.reduce((total,part)=>total+part.quantity*(part.source.dxfSourceEntityCount??1),0);
