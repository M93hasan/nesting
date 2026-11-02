import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['worker/design-document.test.js','src/components/design-component-registry.test.ts','src/components/design-appearance-adapter.test.ts']}});
