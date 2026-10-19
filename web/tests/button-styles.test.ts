import {describe,it,expect} from 'vitest';
import {parseButtonStyles,buttonStylesheet,validateButtonCss} from '../shared/button-styles.js';
describe('scoped button styles',()=>{
  it('loads older settings and round trips states',()=>{
    expect(parseButtonStyles(undefined)).toEqual({});
    const styles={corel:{normal:'color: #fff;',hover:'background: rgb(1, 2, 3);'}};
    expect(parseButtonStyles(JSON.parse(JSON.stringify(styles)))).toEqual(styles);
    expect(buttonStylesheet(styles)).toContain('.corel-transfer-button:hover:not(:disabled){background: rgb(1, 2, 3) !important}');
    expect(buttonStylesheet(styles)).not.toContain('.reference-launch');
  });
  it('rejects selector breakout, network loads and unsupported properties',()=>{
    for(const css of ['color:red;} body{display:none','background: url(https://example.com)','@import "x"','position: fixed','background: var(--remote)','color: red/*x*/','color: \\72 ed'])expect(()=>validateButtonCss(css)).toThrow();
    expect(()=>parseButtonStyles({unknown:{normal:'color: red'}})).toThrow();
    expect(()=>parseButtonStyles({corel:{focus:'color: red'}})).toThrow();
  });
  it('drops empty overrides and preserves compound selectors',()=>{
    expect(parseButtonStyles({corel:{normal:''}})).toEqual({});
    expect(buttonStylesheet({download:{normal:'color: red !important;'}})).toBe(':root #root .download-control .download-button{color: red !important}');
  });
});
