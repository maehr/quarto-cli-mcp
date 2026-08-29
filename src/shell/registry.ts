import { randomUUID } from 'node:crypto';
import { removeDir } from './files.ts';

/**
 * `ProjectState` is internal. SPECS.md says a client sees only the `projectId`, so `root`
 * never leaves this module.
 */
export type ProjectState = {
	readonly id: string;
	readonly root: string;
};

export class UnknownProjectError extends Error {
	constructor(projectId: string) {
		super(`Unknown projectId "${projectId}".`);
		this.name = 'UnknownProjectError';
	}
}

export type Registry = {
	readonly add: (root: string) => ProjectState;
	readonly get: (projectId: string) => ProjectState;
	readonly remove: (projectId: string) => Promise<void>;
	/** Run `task` with no other task running for the same project. */
	readonly withProject: <T>(
		projectId: string,
		task: (project: ProjectState) => Promise<T>,
	) => Promise<T>;
	readonly shutdown: () => Promise<void>;
	readonly size: () => number;
};

export const createRegistry = (): Registry => {
	const projects = new Map<string, ProjectState>();
	// One promise chain per project serializes that project's operations.
	const queues = new Map<string, Promise<unknown>>();

	const get = (projectId: string): ProjectState => {
		const project = projects.get(projectId);
		if (project === undefined) {
			throw new UnknownProjectError(projectId);
		}
		return project;
	};

	const remove = async (projectId: string): Promise<void> => {
		const project = projects.get(projectId);
		if (project === undefined) {
			return;
		}
		projects.delete(projectId);
		queues.delete(projectId);
		await removeDir(project.root);
	};

	return {
		add(root) {
			// An opaque random id. A client cannot guess another project's id.
			const project: ProjectState = { id: randomUUID(), root };
			projects.set(project.id, project);
			return project;
		},
		get,
		remove,
		withProject(projectId, task) {
			const project = get(projectId);
			const previous = queues.get(projectId) ?? Promise.resolve();
			// Swallow the predecessor's rejection so one failure does not poison the queue.
			const run = previous.then(
				() => task(project),
				() => task(project),
			);
			queues.set(
				projectId,
				run.catch(() => undefined),
			);
			return run;
		},
		async shutdown() {
			const roots = [...projects.values()].map((project) => project.root);
			projects.clear();
			queues.clear();
			await Promise.all(roots.map((root) => removeDir(root)));
		},
		size: () => projects.size,
	};
};
