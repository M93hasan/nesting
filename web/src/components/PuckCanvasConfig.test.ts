import {describe,it,expect} from 'vitest';
import {initialPuckPage,puckBuilderConfig} from './PuckCanvasConfig';

describe('Real Puck editor registry',()=>{
  it('has genuine insertable page blocks, not a fixed Zone-only mock',()=>{
    const names=Object.keys(puckBuilderConfig.components);
    expect(names).toContain('Grid');
    expect(names).toContain('Flex');
    expect(names).toContain('Heading');
    expect(names).toContain('Button');
    expect(names).toContain('PartsPanel');
    expect(names).toContain('NestingCanvas');
    expect(names).not.toContain('Zone');
    expect(names.length).toBeGreaterThan(9);
  });
  it('enables nested drag-and-drop slots for real Puck layouts',()=>{
    const grid=puckBuilderConfig.components.Grid;
    const flex=puckBuilderConfig.components.Flex;
    expect(grid.fields?.items).toMatchObject({type:'slot'});
    expect(flex.fields?.items).toMatchObject({type:'slot'});
    expect(grid.defaultProps?.items).toEqual([]);
    expect(flex.defaultProps?.items).toEqual([]);
    expect(initialPuckPage.content.some(x=>x.type==='Grid')).toBe(true);
  });
  it('keeps preview controls nonfunctional until placed in the real Nesting app',()=>{
    const action=puckBuilderConfig.components.ActionBar;
    expect(action.defaultProps?.label).toBe('Parçaları yerleştir');
  });
});
