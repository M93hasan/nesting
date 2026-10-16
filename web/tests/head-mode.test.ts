import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS,type Document,newPart} from '../src/model';
import {applyMachineProfile,machineProfileFromSettings,physicalMaterialWidthMm,setHeadMode,setPhysicalMaterialWidth,checkMachineProfile,upgradeLegacyDualHeadDocument} from '../src/geometry/headMode';
import {normalizeDocument} from '../src/geometry/normalize';
import {withDocumentPlacements} from '../src/geometry/placements';
import {solverInput} from '../src/import/sparrow';
describe('full physical material width in single and dual head modes',()=>{
  it('never divides the entered width when selecting two heads',()=>{
    const settings=setHeadMode({...DEFAULT_SETTINGS,materialWidthMm:1400},'dual');
    expect(settings.materialWidthMm).toBe(1400);
    expect(physicalMaterialWidthMm(settings)).toBe(1400);
    expect(setPhysicalMaterialWidth(settings,1600).materialWidthMm).toBe(1600);
    expect(setHeadMode(settings,'single').materialWidthMm).toBe(1400);
    expect(setHeadMode(setHeadMode(settings,'single'),'dual').materialWidthMm).toBe(1400);
  });
  it('passes the complete width to the Sparrow nesting algorithm',()=>{
    const piece=newPart([[0,0],[20,0],[20,10],[0,10]],'shoe');
    const doc:Document={name:'Dual head',settings:{...setHeadMode(DEFAULT_SETTINGS,'dual')},parts:[piece]};
    expect(normalizeDocument(doc).settings.materialWidthMm).toBe(1400);
    expect(JSON.parse(solverInput(doc)).strip_height).toBeCloseTo(1400+2*.01,2);
    expect(machineProfileFromSettings(doc.settings).physicalWidthMm).toBe(1400);
  });
  it('stores physical width unchanged in a per-user machine profile',()=>{
    const doc:Document={name:'Profile',parts:[],settings:{...DEFAULT_SETTINGS}};
    const profile={headMode:'dual',materialType:'sheet',physicalWidthMm:1200,materialLengthMm:800} as const;
    const applied=applyMachineProfile(doc,profile);
    expect(applied.settings.materialWidthMm).toBe(1200);
    expect(applied.settings.materialLengthMm).toBe(800);
    expect(machineProfileFromSettings(applied.settings)).toEqual(profile);
    expect(checkMachineProfile({...profile,physicalWidthMm:0})).not.toBeNull();
  });
  it('migrates old dual-head half-width projects exactly once without moving copies',()=>{
    const piece=newPart([[0,0],[20,0],[20,10],[0,10]],'shoe');
    const position={partId:piece.id,copyIndex:0,xMm:300,yMm:100,angleDeg:0,sheetIndex:0};
    const old:Document={name:'Old saved project',parts:[piece],
      placements:[position],settings:{...DEFAULT_SETTINGS,headMode:'dual',
        materialWidthMm:700,materialType:'sheet',materialLengthMm:800}};
    const migrated=withDocumentPlacements(old);
    expect(migrated.settings.materialWidthMm).toBe(1400);
    expect(migrated.settings.widthMode).toBe('full');
    expect(migrated.placements?.[0]).toEqual(position);
    expect(withDocumentPlacements(migrated).settings.materialWidthMm).toBe(1400);
    expect(normalizeDocument(old).settings.materialWidthMm).toBe(1400);
    expect(JSON.parse(solverInput(migrated)).strip_height).toBeCloseTo(1400+.02,2);
  });
  it('does not reinterpret a modern dual-head project when reopened',()=>{
    const doc:Document={name:'New project',parts:[],
      settings:{...DEFAULT_SETTINGS,headMode:'dual',widthMode:'full',materialWidthMm:80000}};
    expect(normalizeDocument(doc,true).settings.materialWidthMm).toBe(80000);
    expect(upgradeLegacyDualHeadDocument(doc)).toBe(doc);
    expect(physicalMaterialWidthMm(DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.materialWidthMm);
  });
});
