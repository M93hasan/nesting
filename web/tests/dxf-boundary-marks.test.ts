import {it,expect} from 'vitest';
import {importDXF} from '../src/import/dxf';
it('keeps boundary marks but rejects unrelated paths outside the CAD tolerance',()=>{
 const dxf=`0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nCUT\n90\n4\n70\n1\n10\n0\n20\n0\n10\n20\n20\n0\n10\n20\n20\n20\n10\n0\n20\n20\n0\nLINE\n8\nCUT\n10\n0\n20\n5\n11\n5\n21\n5\n0\nLINE\n8\nCUT\n10\n20.1\n20\n8\n11\n21\n21\n8\n0\nENDSEC\n0\nEOF\n`;
 const review=importDXF(dxf,'boundary.dxf',{scale:1,tolerance:.01,enclosed:'holes'});
 expect(review.document.parts).toHaveLength(1);
 expect(review.document.parts[0].source.dxfSourceEntityCount).toBe(2);
 expect(review.document.parts[0].source.dxfAux).toHaveLength(1);
 expect(review.issues).toHaveLength(1);
 expect(review.issues?.[0]).toContain('outside every closed part');
});
