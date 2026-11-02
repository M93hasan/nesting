import {describe,it,expect} from 'vitest';
import {DESIGN_COMPONENTS,ROOT_COMPONENTS,isDesignComponentId,normalizeRootOrder,canReorder,reorderRoot} from './design-component-registry';

describe('design component registry',()=>{
  it('contains unique allowlisted components',()=>{
    expect(new Set(DESIGN_COMPONENTS.map(x=>x.id)).size).toBe(DESIGN_COMPONENTS.length);
    expect(ROOT_COMPONENTS.map(x=>x.id)).toEqual(['heading','panel']);
    expect(isDesignComponentId('button')).toBe(true);
    expect(isDesignComponentId('script')).toBe(false);
  });
  it('rejects invalid or nested root orders',()=>{
    expect(normalizeRootOrder(['panel','heading'])).toEqual(['panel','heading']);
    expect(normalizeRootOrder(['panel','button'])).toEqual(['heading','panel']);
    expect(normalizeRootOrder(['panel','panel'])).toEqual(['heading','panel']);
    expect(normalizeRootOrder(null)).toEqual(['heading','panel']);
  });
  it('reorders only root components without mutating input',()=>{
    const before=['heading','panel'] as const;
    expect(reorderRoot(before,'heading','panel')).toEqual(['panel','heading']);
    expect(before).toEqual(['heading','panel']);
    expect(canReorder('button','heading')).toBe(false);
    expect(reorderRoot(before,'button','heading')).toEqual(['heading','panel']);
  });
});
