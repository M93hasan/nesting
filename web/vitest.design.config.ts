import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['worker/design-document.test.js','worker/design-routes.test.js','src/components/design-component-registry.test.ts','src/components/design-appearance-adapter.test.ts','src/components/design-zone-styles.test.ts','src/components/puck-design-adapter.test.ts','src/components/PuckCanvasConfig.test.ts']}});
