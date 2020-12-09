import { Event, EventObjectImpl, EventSubscriber, EventSubscription } from "./events";
import { getEventSubscriptions } from "./helpers";

export interface EventScopeSettings {
	/**
	 * Controls the maximum number of times that a child event scope can transfer events to its parent
	 * while the parent scope is exiting. A large number indicates that the consumer of the event scope
	 * is likely cycling through the same activities repeatedly (i.e. infinite loop). This setting can
	 * be used to cause the event scope to exit before the browser chooses to terminate the script in
	 * a way that it may not be able to fully recover from.
	 */
	maxExitingTransferCount: number;

	/**
	 * Controls the maximum depth that an event scope can reach. A large number indicates that the consumer
	 * of the event scope is likely cycling through the same activities repeatedly (i.e. infinite recursion)
	 * and the browser's "max stack" limit will likely be reached at some point. This setting can be
	 * used to cause the event scope to exit before the limit is reached, in order to avoid the browser
	 * terminating the script in a way that it may not be able to fully recover from.
	 */
	maxDepth: number;
}

export const EVENT_SCOPE_DEFAULT_SETTINGS: EventScopeSettings = {
	maxExitingTransferCount: 100,
	maxDepth: 1000
};

export interface EventScopeExitEventArgs {
	abort: boolean;
}

export interface EventScopeErrorEventArgs {
	error: Error;
}

let __lastEventScopeId = 0;

export class EventScope {
	readonly parent: EventScope;

	current: EventScope = null;
	isActive: boolean;

	readonly settings: EventScopeSettings;
	readonly onError: EventSubscriber<EventScope, EventScopeErrorEventArgs>;

	private readonly _uid: number;
	private readonly _depth: number;

	private readonly _onExit: EventSubscriber<EventScope, EventScopeExitEventArgs>;
	private _exitEventVersion: number;

	private constructor(parent: EventScope, maxExitingTransferCount: number, maxDepth: number, isActive: boolean = false) {
		this.parent = parent;
		this.current = null;
		this.isActive = isActive;
		this.settings = { maxExitingTransferCount, maxDepth };
		this.onError = new Event<EventScope, EventScopeErrorEventArgs>();
		this._uid = ++__lastEventScopeId;
		this._depth = parent === null ? 1 : parent._depth + 1;
		this._onExit = new Event<EventScope, EventScopeExitEventArgs>();
	}

	static create({ maxExitingTransferCount = EVENT_SCOPE_DEFAULT_SETTINGS.maxExitingTransferCount, maxDepth = EVENT_SCOPE_DEFAULT_SETTINGS.maxDepth }: EventScopeSettings): EventScope {
		return new EventScope(null, maxExitingTransferCount, maxDepth, false);
	}

	/**
	 * Creates a new event scope, performs the action, then exits the scope
	 * @param callback The action to perform within the new scope
	 */
	perform(callback: Function): void {
		var scope = new EventScope(this.current, this.settings.maxExitingTransferCount, this.settings.maxDepth, true);

		let isDisposing = false;

		try {
			this.current = scope;

			if (scope._depth >= this.settings.maxDepth)
				throw new Error("Exceeded max scope depth.");

			// Invoke the callback
			callback();

			// Dispose of the event scope
			isDisposing = true;
			this.current.dispose({ abort: false });
		}
		catch (e) {
			if (!isDisposing)
				this.current.dispose({ abort: true });

			const errorEvent = (this.onError as Event<EventScope, EventScopeErrorEventArgs>).publish(this, { error: e }) as EventObjectImpl & EventScopeErrorEventArgs;
			if (!errorEvent.isDefaultPrevented)
				throw e;
		}
		finally {
			// Roll back to the closest active scope
			while (this.current && !this.current.isActive) {
				this.current = this.current.parent;
			}
		}
	}

	/**
	 * Subscribes to the "exit" event of the current scope, or invokes immediately if there is not a current scope
	 * @param handler The event handler to invoke when exited
	 */
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
						try {
							// Attempt to move subscribers to the parent scope
							this.parent.receiveExitEventSubscribers(exitSubscriptions);
						}
						catch (e) {
							this.dispose({ abort: true });
							throw e;
						}
					}
				}
			}

			// Clear the events to ensure that they aren't inadvertantly raised again through this scope
			this._onExit.clear();
		}
		finally {
			// The event scope is no longer active
			this.isActive = false;
		}
	}

	private receiveExitEventSubscribers(subscriptions: EventSubscription<EventScope, EventScopeExitEventArgs>[]) {
		var maxNesting = this.settings.maxExitingTransferCount - 1;
		if (this._exitEventVersion >= maxNesting) {
			throw new Error("Exceeded max scope event transfer.");
		}

		// Move subscribers to the parent scope
		subscriptions.forEach(sub => this._onExit.subscribe(sub.handler));

		if (this._exitEventVersion !== undefined) {
			this._exitEventVersion++;
		}
	}

	toString() {
		return `${(this.parent ? this.parent.toString() + "->" : "")}${this._uid}`;
	}
}
