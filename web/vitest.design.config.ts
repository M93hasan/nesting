import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['worker/design-document.test.js','worker/design-routes.test.js','src/components/design-zone-styles.test.ts']}});
