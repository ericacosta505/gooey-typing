import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const file of readdirSync('dist').filter(name => name.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', `dist/${file}`], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log('All application modules passed syntax checks.');
