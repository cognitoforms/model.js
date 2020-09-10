import { Entity } from "./entity";
import { Property } from "./property";

export type InitializationValueResolver = (instance: Entity, property: Property, value: any) => Promise<any>;

export class InitializationContext {
	private newDocument = false;
	private valueResolver: InitializationValueResolver;
	private tasks = new Set<Promise<any>>();
	private waiting: (() => void)[] = [];

	constructor(newDocument: boolean, valueResolver?: InitializationValueResolver) {
		this.newDocument = newDocument;
		this.valueResolver = valueResolver;
	}

	/**
	 * Prevents any waiting callbacks from being executed before the specified action completes.
	 * @returns The return value of `action`.
	 */
	execute<T>(action: () => T): T {
		// create a promise which will never actually be resolved, but it will prevent the waiting queue from being processed
		const marker = new Promise(() => {});
		this.tasks.add(marker);

		const result = action();

		this.tasks.delete(marker);
		this.processWaitingQueue();

		return result;
	}

	wait(task: Promise<any>) {
		this.tasks.add(task);
		task.then(() => {
			this.tasks.delete(task);
			// process the queue asynchronously to allow additional tasks to be queued as a result of this one
			Promise.resolve().then(() => this.processWaitingQueue());
		});
	}

	get canProcessQueue() {
		return this.tasks.size === 0;
	}

	private processWaitingQueue() {
		if (this.canProcessQueue) {
			while (this.waiting.length > 0 && this.canProcessQueue) {
				const done = this.waiting.shift();
				done();
			}
		}
	}

	whenReady(callback: () => void) {
		if (this.canProcessQueue)
			callback();
		else
			this.waiting.push(callback);
	}

	tryResolveValue(instance: Entity, property: Property, value: any) {
		const task = this.valueResolver && this.valueResolver(instance, property, value);
		if (task)
			this.wait(task);
		return task;
	}

	get isNewDocument() {
		return this.newDocument;
	}

	get ready() {
		return new Promise(resolve => this.whenReady(resolve));
	}
}
