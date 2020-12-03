import { Functor$create, FunctorWith1Arg, FunctorItem } from "./functor";
import { hasOwnProperty } from "./helpers";

export interface EventObject {
	preventDefault(): void;
}

export class EventObjectImpl implements EventObject {
	isDefaultPrevented: boolean = false;
	preventDefault(): void {
		this.isDefaultPrevented = true;
	}
}

export interface EventHandler<This, EventArgsType> {
    (this: This, event: EventObject & EventArgsType): void;
}

export interface EventSubscriber<This, EventArgsType> {
    subscribe(handler: EventHandler<This, EventArgsType>): void;
    subscribeOne(handler: EventHandler<This, EventArgsType>): void;
    unsubscribe(handler: EventHandler<This, EventArgsType>): void;
	hasSubscribers(handler?: EventHandler<This, EventArgsType>): boolean;
    clear(): void;
}

export interface EventPublisher<This, EventArgsType> extends EventSubscriber<This, EventArgsType> {
	publish(thisObject: This, args: EventArgsType): void;
}

export interface EventSubscription<This, EventArgsType> {
	handler: EventHandler<This, EventArgsType>;
	isExecuted?: boolean;
	isOnce?: boolean;
}

export interface EventSubscriptionChanged<EventType> {
    (event: EventType): void;
}

function createEventObject<EventArgsType>(args: EventArgsType): EventObject & EventArgsType {
	let eventObject: EventObject = new EventObjectImpl();

	for (var prop in args) {
		if (hasOwnProperty(args, prop)) {
			(eventObject as any)[prop] = args[prop];
		}
	}

	return eventObject as EventObject & EventArgsType;
}

export class Event<This, EventArgsType> implements EventPublisher<This, EventArgsType>, EventSubscriber<This, EventArgsType> {
    private func: FunctorWith1Arg<EventArgsType, void> & ((this: This, args: EventObject & EventArgsType) => void);
    private readonly subscriptionChanged: EventSubscriptionChanged<Event<This, EventArgsType>>;

    constructor(subscriptionChanged?: EventSubscriptionChanged<Event<This, EventArgsType>>) {
    	if (subscriptionChanged) {
    		this.subscriptionChanged = subscriptionChanged;
    	}
    }

    publish(thisObject: This, args: EventArgsType): EventObject & EventArgsType {
    	if (!this.func) {
    		// No subscribers
    		return;
    	}
    	let eventObject = createEventObject<EventArgsType>(args);
    	this.func.call(thisObject, eventObject);
    	return eventObject;
    }

    subscribe(handler: EventHandler<This, EventArgsType>): void {
    	if (!this.func) {
    		Object.defineProperty(this, "func", { value: Functor$create() });
    	}
    	this.func.add(handler);
    	if (this.subscriptionChanged)
    		this.subscriptionChanged(this);
    }

    subscribeOne(handler: EventHandler<This, EventArgsType>): void {
    	if (!this.func) {
    		Object.defineProperty(this, "func", { value: Functor$create() });
    	}
    	this.func.add(handler, null, true);
    	if (this.subscriptionChanged)
    		this.subscriptionChanged(this);
    }

    hasSubscribers(handler?: EventHandler<This, EventArgsType>): boolean {
    	if (!this.func) {
    		return false;
    	}

    	let functorItems = ((this.func as any)._funcs) as FunctorItem[];
    	return handler ? functorItems.some(function(i) { return i.fn === handler; }) : functorItems.length > 0;
    }

    unsubscribe(handler: EventHandler<This, EventArgsType>): void {
    	if (!this.func) {
    		// No subscribers
    		return;
    	}
    	this.func.remove(handler);
    	if (this.subscriptionChanged)
    		this.subscriptionChanged(this);
    }

    clear(): void {
    	if (!this.func) {
    		// No subscribers
    		return;
    	}
    	this.func.clear();
    	if (this.subscriptionChanged)
    		this.subscriptionChanged(this);
    }
}
