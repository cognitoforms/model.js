import { Entity } from "./entity";
import { Property } from "./property";

export class InitializationContext {
	private newDocument = false;
	private tasks = new Set<Promise<any>>();
	private waiting: { onfullfilled: (() => void), onrejected?: (error: Error) => void }[] = [];

	constructor(newDocument: boolean) {
		this.newDocument = newDocument;
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
			// process the queue asynchronously to allow additional tasks to be queued as a result of this one
			Promise.resolve().then(() => {
				this.tasks.delete(task);
				this.processWaitingQueue();
			});
		}).catch(e => {
			console.error("Task failed with error: ", e);
			Promise.resolve().then(() => {
				this.tasks.delete(task);
				this.processWaitingQueue(false, e);
			});
		});
	}

	get canProcessQueue() {
		return this.tasks.size === 0;
	}

	private processWaitingQueue(fullfilled: boolean = true, error: Error = null) {
		if (this.canProcessQueue) {
			while (this.waiting.length > 0 && this.canProcessQueue) {
				const waiting = this.waiting.shift();
				if (fullfilled)
					waiting.onfullfilled();
				else if (waiting.onrejected)
					waiting.onrejected(error);
			}
		}
	}

	whenReady(onfullfilled: () => void, onrejected?: (error: Error) => void) {
		if (this.canProcessQueue)
			onfullfilled();
		else
			this.waiting.push({ onfullfilled, onrejected });
	}

	tryResolveValue(instance: Entity, property: Property, value: any) {
		const task = instance.serializer.resolveValue(instance, property, value);
		if (task)
			this.wait(task);
		return task;
	}

	get isNewDocument() {
		return this.newDocument;
	}

	get ready() {
		return new Promise<void>(resolve => this.whenReady(resolve));
	}
}
