import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

function deploymentCommitMarker() {
  return {
    name: 'serula-deployment-commit-marker',
    apply: 'build' as const,
    closeBundle() {
      const commit = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA ||
        execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {encoding:'utf8'}).trim();
      if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Cannot determine deployment commit SHA');
      writeFileSync(resolve(import.meta.dirname ?? '.', 'dist/deploy-version.txt'), `Git commit: ${commit}\n`);
    },
  };
}

export default defineConfig({
  base:'./',
  plugins:[deploymentCommitMarker()],
  optimizeDeps:{include:['dxf/lib/parseString','dxf/lib/util/bSpline']},
  worker:{format:'es'},
  preview:{headers:{}},
  server:{headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},
  build:{rollupOptions:{input:{app:'index.html',bridge:'bridge.html'}}},
});
