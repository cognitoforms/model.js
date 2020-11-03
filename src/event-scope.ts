import { Event, EventSubscriber } from "./events";
import { getEventSubscriptions } from "./helpers";

export let EventScope$current: EventScope = null;

let __lastEventScopeId = 0;

// TODO: Make `nonExitingScopeNestingCount` an editable configuration value
// Controls the maximum number of times that a child event scope can transfer events
// to its parent while the parent scope is exiting. A large number indicates that
// rules are not reaching steady-state. Technically something other than rules could
// cause this scenario, but in practice they are the primary use-case for event scope.
const nonExitingScopeNestingCount = 100;

interface EventScopeExitEventArgs {
}

interface EventScopeAbortEventArgs {
	maxNestingExceeded: boolean;
}

export class EventScope {
	parent: EventScope;

	isActive: boolean;

	readonly _uid: number;

	private _exitEventVersion: number;
	private _exitEventHandlerCount: number;

	readonly onExit: EventSubscriber<EventScope, EventScopeExitEventArgs>;
	readonly onAbort: EventSubscriber<EventScope, EventScopeAbortEventArgs>;

	constructor() {
		this._uid = ++__lastEventScopeId;

		// If there is a current event scope
		// then it will be the parent of the new event scope
		this.parent = EventScope$current;

		this.isActive = true;
		this.onExit = new Event<EventScope, EventScopeExitEventArgs>();
		this.onAbort = new Event<EventScope, EventScopeAbortEventArgs>();

		EventScope$current = this;
	}

	abort(maxNestingExceeded: boolean = false): void {
		if (!this.isActive) {
			throw new Error("The event scope cannot be aborted because it is not active.");
		}

		try {
			(this.onAbort as Event<EventScope, EventScopeAbortEventArgs>).publish(this, { maxNestingExceeded: maxNestingExceeded });

			// Clear the events to ensure that they aren't
			// inadvertantly raised again through this scope
			this.onAbort.clear();
			this.onExit.clear();
		}
		finally {
			this.dispose();
		}
	}

	exit(): void {
		if (!this.isActive) {
			throw new Error("The event scope cannot be exited because it is not active.");
		}

		let scopeAborted = false;

		try {
			var exitSubscriptions = getEventSubscriptions(this.onExit as Event<EventScope, EventScopeExitEventArgs>);
			if (exitSubscriptions && exitSubscriptions.length > 0) {
				// If there is no parent scope, then go ahead and execute the 'exit' event
				if (this.parent === null || !this.parent.isActive) {
					// Record the initial version and initial number of subscribers
					this._exitEventVersion = 0;
					this._exitEventHandlerCount = exitSubscriptions.length;

					// Invoke all subscribers
					(this.onExit as Event<EventScope, EventScopeExitEventArgs>).publish(this, {});

					// Delete the fields to indicate that raising the exit event suceeded
					delete this._exitEventHandlerCount;
					delete this._exitEventVersion;
				}
				else {
					// if (typeof ...config.nonExitingScopeNestingCount === "number") { ...
					var maxNesting = nonExitingScopeNestingCount - 1;
					if (this.parent._exitEventVersion >= maxNesting) {
						this.abort(true);
						console.warn(`[event-scope] Exceeded max nesting of ${maxNesting}`);
						scopeAborted = true;
						return;
					}

					// Move subscribers to the parent scope
					exitSubscriptions.forEach(sub => {
						if (!sub.isOnce || !sub.isExecuted) {
							this.parent.onExit.subscribe(sub.handler);
						}
					});

					if (this.parent._exitEventVersion !== undefined) {
						this.parent._exitEventVersion++;
					}
				}

				// Clear the events to ensure that they aren't
				// inadvertantly raised again through this scope
				this.onAbort.clear();
				this.onExit.clear();
			}
		}
		finally {
			if (!scopeAborted)
				this.dispose();
		}
	}

	dispose() {
		// The event scope is no longer active
		this.isActive = false;

		if (this !== EventScope$current) {
			console.warn(`Disposed of non-current event scope ${this._uid}.`);
			return;
		}

		// Roll back to the closest active scope
		while (EventScope$current && !EventScope$current.isActive) {
			EventScope$current = EventScope$current.parent;
		}
	}
}

export function EventScope$onExit(callback: Function): void {
	if (EventScope$current === null) {
		// Immediately invoke the callback
		callback();
	}
	else if (!EventScope$current.isActive) {
		throw new Error("The current event scope cannot be inactive.");
	}
	else {
		// Subscribe to the exit event
		EventScope$current.onExit.subscribe(callback as any);
	}
}

export function EventScope$onAbort(callback: Function): void {
	if (EventScope$current !== null) {
		if (!EventScope$current.isActive) {
			throw new Error("The current event scope cannot be inactive.");
		}

		// Subscribe to the abort event
		EventScope$current.onAbort.subscribe(callback as any);
	}
}

export function EventScope$perform(callback: Function): void {
	// Create an event scope
	var scope = new EventScope();
	try {
		// Invoke the callback
		callback();
	}
	finally {
		// Exit the event scope
		scope.exit();
	}
}
