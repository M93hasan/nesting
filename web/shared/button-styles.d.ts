export type ButtonStyles=Record<string,Partial<Record<'normal'|'hover'|'disabled',string>>>;
export const BUTTON_TARGETS:string[][];
export function validateButtonCss(css:string):string;
export function parseButtonStyles(value:unknown):ButtonStyles;
export function buttonStylesheet(styles:ButtonStyles):string;
export function validateCustomCss(css:string):string;
export function customCssStylesheet(css:string):string;
