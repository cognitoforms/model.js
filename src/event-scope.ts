import { Event, EventSubscriber } from "./events";
import { getEventSubscriptions } from "./helpers";

// Controls the maximum number of times that a child event scope can transfer events
// to its parent while the parent scope is exiting. A large number indicates that
// rules are not reaching steady-state. Technically something other than rules could
// cause this scenario, but in practice they are the primary use-case for event scope.
export const EventScope$nonExitingScopeNestingCount = 100;

export interface EventScopeExitEventArgs {
	abort: boolean;
}

let __lastEventScopeId = 0;

export class EventScope {
	readonly parent: EventScope;

	current: EventScope = null;
	isActive: boolean;

	private readonly _uid: number;

	private readonly _onExit: EventSubscriber<EventScope, EventScopeExitEventArgs>;
	private _exitEventVersion: number;

	private constructor(parent: EventScope, isActive: boolean = false) {
		this.parent = parent;
		this.current = null;
		this.isActive = isActive;
		this._uid = ++__lastEventScopeId;
		this._onExit = new Event<EventScope, EventScopeExitEventArgs>();
	}

	static create(): EventScope {
		return new EventScope(null, false);
	}

	perform(callback: Function): void {
		// Create an event scope
		var scope = new EventScope(this.current, true);
		let isDisposing = false;
		try {
			this.current = scope;
			// Invoke the callback
			callback();
			isDisposing = true;
			scope.dispose({ abort: false });
		}
		catch (e) {
			if (!isDisposing) {
				// Exit the event scope
				scope.dispose({ abort: true });
			}
		}
		finally {
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

	onExit(handler: (args: EventScopeExitEventArgs) => void): void {
		if (this.current === null) {
			// Immediately invoke the callback
			handler({ abort: false });
		}
		else if (!this.current.isActive) {
			throw new Error("The current event scope cannot be inactive.");
		}
		else {
			// Subscribe to the exit event
			this.current._onExit.subscribe(handler);
		}
	}

	private dispose({ abort = false }: EventScopeExitEventArgs): void {
		if (!this.isActive) {
			throw new Error("The event scope cannot be exited because it is not active.");
		}

		try {
			if (abort) {
				(this._onExit as Event<EventScope, EventScopeExitEventArgs>).publish(this, { abort: true });
			}
			else {
				var exitSubscriptions = getEventSubscriptions(this._onExit as Event<EventScope, EventScopeExitEventArgs>);
				if (exitSubscriptions && exitSubscriptions.length > 0) {
					// If there is no parent scope, then go ahead and execute the 'exit' event
					if (this.parent === null || !this.parent.isActive) {
						// Record the initial "version" before starting to call subscribers
						this._exitEventVersion = 0;

						// Invoke all subscribers
						(this._onExit as Event<EventScope, EventScopeExitEventArgs>).publish(this, { abort: false });

						// Delete the field to indicate that raising the exit event suceeded
						delete this._exitEventVersion;
					}
					else {
						var maxNesting = EventScope$nonExitingScopeNestingCount - 1;
						if (this.parent._exitEventVersion >= maxNesting) {
							this.exit({ abort: true });
							console.warn("Exceeded max scope nesting.");
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
				}

				// Clear the events to ensure that they aren't inadvertantly raised again through this scope
				this._onExit.clear();
			}
		}
		finally {
			// The event scope is no longer active
			this.isActive = false;
		}
	}
}
