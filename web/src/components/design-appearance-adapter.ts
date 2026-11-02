import type {Appearance} from '../appearance';

/** Maps existing persisted Serula appearance into editor-safe preview tokens.
 * Does not write to /api/admin/appearance or modify production CSS.
 */
export type SerulaPreviewTokens={background:string;panel:string};
const COLOR=/^#[0-9a-f]{6}$/i;
export function appearanceToPreviewTokens(value:Pick<Appearance,'background'|'panel'>):SerulaPreviewTokens {
  if(!COLOR.test(value.background)||!COLOR.test(value.panel))throw Error('Geçersiz Serula renkleri');
  return {background:value.background.toLowerCase(),panel:value.panel.toLowerCase()};
}
export const SERULA_TOKEN_TARGETS={
  background:'--appearance-background',
  panel:'--appearance-panel',
} as const;
