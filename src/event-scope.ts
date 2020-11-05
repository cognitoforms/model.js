import { Event, EventSubscriber } from "./events";
import { getEventSubscriptions } from "./helpers";

let __lastEventScopeId = 0;

// Controls the maximum number of times that a child event scope can transfer events
// to its parent while the parent scope is exiting. A large number indicates that
// rules are not reaching steady-state. Technically something other than rules could
// cause this scenario, but in practice they are the primary use-case for event scope.
export const EventScope$nonExitingScopeNestingCount = 100;

interface EventScopeExitEventArgs {
}

interface EventScopeAbortEventArgs {
	maxNestingExceeded: boolean;
}

export class EventScope {
	parent: EventScope;

	current: EventScope = null;

	isActive: boolean;

	readonly _uid: number;

	private _exitEventVersion: number;
	private _exitEventHandlerCount: number;

	readonly _onExit: EventSubscriber<EventScope, EventScopeExitEventArgs>;
	readonly _onAbort: EventSubscriber<EventScope, EventScopeAbortEventArgs>;

	private constructor(parent: EventScope, isActive: boolean = false) {
		this._uid = ++__lastEventScopeId;
		this.parent = parent;
		this.isActive = isActive;
		this._onExit = new Event<EventScope, EventScopeExitEventArgs>();
		this._onAbort = new Event<EventScope, EventScopeAbortEventArgs>();
	}

	static create(): EventScope {
		return new EventScope(null, false);
	}

	abort(maxNestingExceeded: boolean = false): void {
		if (!this.isActive) {
			throw new Error("The event scope cannot be aborted because it is not active.");
		}

		try {
			(this._onAbort as Event<EventScope, EventScopeAbortEventArgs>).publish(this, { maxNestingExceeded: maxNestingExceeded });

			// Clear the events to ensure that they aren't
			// inadvertantly raised again through this scope
			this._onAbort.clear();
			this._onExit.clear();
		}
		finally {
			// The event scope is no longer active
			this.isActive = false;
		}
	}

	exit(): void {
		if (!this.isActive) {
			throw new Error("The event scope cannot be exited because it is not active.");
		}

		let scopeAborted = false;

		try {
			var exitSubscriptions = getEventSubscriptions(this._onExit as Event<EventScope, EventScopeExitEventArgs>);
			if (exitSubscriptions && exitSubscriptions.length > 0) {
				// If there is no parent scope, then go ahead and execute the 'exit' event
				if (this.parent === null || !this.parent.isActive) {
					// Record the initial version and initial number of subscribers
					this._exitEventVersion = 0;
					this._exitEventHandlerCount = exitSubscriptions.length;

					// Invoke all subscribers
					(this._onExit as Event<EventScope, EventScopeExitEventArgs>).publish(this, {});

					// Delete the fields to indicate that raising the exit event suceeded
					delete this._exitEventHandlerCount;
					delete this._exitEventVersion;
				}
				else {
					var maxNesting = EventScope$nonExitingScopeNestingCount - 1;
					if (this.parent._exitEventVersion >= maxNesting) {
						this.abort(true);
						console.warn("Exceeded max scope nesting.");
						scopeAborted = true;
						return;
					}

					// Move subscribers to the parent scope
					exitSubscriptions.forEach(sub => {
						if (!sub.isOnce || !sub.isExecuted) {
							this.parent._onExit.subscribe(sub.handler);
						}
					});

					if (this.parent._exitEventVersion !== undefined) {
						this.parent._exitEventVersion++;
					}
				}

				// Clear the events to ensure that they aren't
				// inadvertantly raised again through this scope
				this._onAbort.clear();
				this._onExit.clear();
			}
		}
		finally {
			if (!scopeAborted) {
				// The event scope is no longer active
				this.isActive = false;
			}
		}
	}

	onExit(callback: Function): void {
		if (this.current === null) {
			// Immediately invoke the callback
			callback();
		}
		else if (!this.current.isActive) {
			throw new Error("The current event scope cannot be inactive.");
		}
		else {
			// Subscribe to the exit event
			this.current._onExit.subscribe(callback as any);
		}
	}

	onAbort(callback: Function): void {
		if (this.current !== null) {
			if (!this.current.isActive) {
				throw new Error("The current event scope cannot be inactive.");
			}

			// Subscribe to the abort event
			this.current._onAbort.subscribe(callback as any);
		}
	}

	perform(callback: Function): void {
		// Create an event scope
		var scope = new EventScope(this.current, true);
		try {
			this.current = scope;
			// Invoke the callback
			callback();
		}
		finally {
			// Exit the event scope
			scope.exit();

			if (scope !== this.current) {
				console.warn(`Exited non-current event scope ${scope._uid}.`);
			}
			else {
				// Roll back to the closest active scope
				while (this.current && !this.current.isActive) {
					this.current = this.current.parent;
				}
			}
		}
	}
}
