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

	wait(task: Promise<any>) {
		this.tasks.add(task);
		task.then(() => {
			this.tasks.delete(task);
			if (this.tasks.size === 0)
				this.waiting.forEach(done => done());
		});
	}

	ready(callback: () => void) {
		if (this.tasks.size === 0)
			callback();

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
}
