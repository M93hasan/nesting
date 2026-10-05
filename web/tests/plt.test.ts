import {expect,it} from 'vitest';
import {bounds} from '../src/geometry/normalize';
import {HPGL_PLOTTER_UNIT_MM,importPLT} from '../src/import/plt';

const options={tolerance:.01};

it('imports absolute HP-GL closed contours in real plotter units',()=>{
  const review=importPLT('IN;SP1;PU0,0;PD4000,0,4000,2000,0,2000,0,0;PU;','plate.plt',options);
  expect(HPGL_PLOTTER_UNIT_MM).toBe(.025);
  expect(review.document.parts).toHaveLength(1);
  expect(bounds(review.document.parts[0].outer)).toEqual([0,0,100,50]);
  expect(review.document.parts[0].source.format).toBe('plt');
});

it('supports relative PR paths and preserves nested contours as holes',()=>{
  const relative=importPLT('IN;PU0,0;PD;PR400,0,0,400,-400,0,0,-400;PU;','relative.plt',options);
  expect(bounds(relative.document.parts[0].outer)).toEqual([0,0,10,10]);

  const nested=importPLT('IN;PU0,0;PD1600,0,1600,1600,0,1600,0,0;PU;PU400,400;PD1200,400,1200,1200,400,1200,400,400;PU;','nested.plt',options);
  expect(nested.document.parts).toHaveLength(1);
  expect(nested.document.parts[0].holes).toHaveLength(1);
});

it('supports explicit IP + SC user scaling without changing physical size',()=>{
  const review=importPLT('IN;IP0,0,4000,2000;SC0,100,0,50;PU0,0;PD100,0,100,50,0,50,0,0;PU;','scaled.plt',options);
  expect(bounds(review.document.parts[0].outer)).toEqual([0,0,100,50]);
});

it('ignores open pen paths instead of turning them into parts',()=>{
  expect(()=>importPLT('IN;PU0,0;PD400,0,400,400;PU;','open.plt',options)).toThrow('kapalı kontur');
});
