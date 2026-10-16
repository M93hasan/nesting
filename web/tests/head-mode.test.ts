import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS,type Document} from '../src/model';
import {applyMachineProfile,machineProfileFromSettings,physicalMaterialWidthMm,setHeadMode,setPhysicalMaterialWidth,checkMachineProfile} from '../src/geometry/headMode';
import {normalizeDocument} from '../src/geometry/normalize';
import {solverInput} from '../src/import/sparrow';
import {newPart} from '../src/model';
describe('two-head production zone',()=>{
  it('1400 mm physical width makes 700 mm nesting width without changing physical size',()=>{
    const settings=setHeadMode({...DEFAULT_SETTINGS,materialWidthMm:1400},'dual');
    expect(settings.materialWidthMm).toBe(700);
    expect(physicalMaterialWidthMm(settings)).toBe(1400);
    expect(setPhysicalMaterialWidth(settings,1600).materialWidthMm).toBe(800);
    expect(setHeadMode(settings,'single').materialWidthMm).toBe(1400);
  });
  it('normalization and Sparrow respect the half-width job',()=>{
    const piece=newPart([[0,0],[20,0],[20,10],[0,10]],'shoe');
    const doc:Document={name:'Dual head',settings:{...setHeadMode(DEFAULT_SETTINGS,'dual')},parts:[piece]};
    expect(normalizeDocument(doc).settings.materialWidthMm).toBe(700);
    expect(JSON.parse(solverInput(doc)).strip_height).toBeCloseTo(700+2*.01,2);
    expect(machineProfileFromSettings(doc.settings).physicalWidthMm).toBe(1400);
  });
  it('roll and sheet profiles persist their effective dimension separately',()=>{
    const doc:Document={name:'Profile',parts:[],settings:{...DEFAULT_SETTINGS}};
    const profile={headMode:'dual',materialType:'sheet',physicalWidthMm:1200,materialLengthMm:800} as const;
    const applied=applyMachineProfile(doc,profile);
    expect(applied.settings.materialWidthMm).toBe(600);
    expect(applied.settings.materialLengthMm).toBe(800);
    expect(machineProfileFromSettings(applied.settings)).toEqual(profile);
    expect(checkMachineProfile({...profile,physicalWidthMm:0})).not.toBeNull();
  });
  it('keeps single-head project settings compatible',()=>{
    expect(physicalMaterialWidthMm(DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.materialWidthMm);
  });
});
