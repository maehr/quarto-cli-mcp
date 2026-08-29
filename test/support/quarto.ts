import { spawnSync } from 'node:child_process';

/** Integration tests need the real Quarto CLI. They skip when it is absent. */
export const hasQuarto = ((): boolean => {
	const probe = spawnSync('quarto', ['--version'], { shell: false });
	return probe.status === 0;
})();
