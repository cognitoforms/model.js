import { Event, EventObject, EventSubscriber } from "./events";
import { Format } from "./format";
import { Type, EntityType, isEntityType, getIdFromState, Type$createOrUpdate } from "./type";
import { InitializationContext } from "./initilization-context";
import { ObjectMeta } from "./object-meta";
import { Property, Property$init, Property$setter } from "./property";
import { ObjectLookup, entries } from "./helpers";

export class Entity {
	static ctorDepth: number = 0;

	readonly meta: ObjectMeta;

	readonly __fields__: { [name: string]: any };
	readonly __pendingInit__: { [name: string]: boolean };

	readonly accessed: EventSubscriber<Entity, EntityAccessEventArgs>;
	readonly changed: EventSubscriber<Entity, EntityChangeEventArgs>;
	private _context: InitializationContext = null;

	constructor(); // Prototype assignment *** used internally
	constructor(type: Type, id: string, properties?: ObjectLookup<any>, context?: InitializationContext); // Construct existing instance with state
	constructor(type: Type, properties?: ObjectLookup<any>, context?: InitializationContext); // Construct new instance with state
	constructor(type?: Type, id?: string | ObjectLookup<any>, properties?: ObjectLookup<any>, context?: InitializationContext) {
		if (arguments.length === 0) {
			// TODO: Warn about direct call in dev build?
		}
		else if (Entity.ctorDepth === 0)
			throw new Error("Entity constructor should not be called directly.");
		else {
			this.accessed = new Event<Entity, EntityAccessEventArgs>();
			this.changed = new Event<Entity, EntityChangeEventArgs>();

			let isNew = false;

			if (typeof id === "string")
				type.assertValidId(id);
			else {
				// Was id provided as undefined, or not provided at all?
				if (id !== null && typeof id === "object")
					properties = id;
				id = type.newId();
				isNew = context ? context.isNewDocument : true;
			}

			// If context was provided, it should be the last argument
			context = arguments[arguments.length - 1];
			if (!(context instanceof InitializationContext))
				context = new InitializationContext(isNew);

			this.meta = new ObjectMeta(type, this, id, isNew);

			Object.defineProperty(this, "__fields__", { enumerable: false, configurable: false, writable: false, value: {} });
			Object.defineProperty(this, "__pendingInit__", { enumerable: false, configurable: false, writable: false, value: {} });

			// Register the newly constructed instance
			type.register(this);

			// Initialize existing entity with provided property values
			if (!isNew && properties) {
				// We need to pause processing of callbacks to prevent publishing entity events while still processing the state graph
				const resumeContextQueue = context.delayQueue();
				this.init(properties, context);
				resumeContextQueue();
			}

			// Raise the initNew or initExisting event on this type and all base types
			context.whenReady(() => {
				for (let t = type; t; t = t.baseType) {
					if (isNew)
						(t.initNew as Event<Type, EntityInitNewEventArgs>).publish(t, { entity: this });
					else
						(t.initExisting as Event<Type, EntityInitExistingEventArgs>).publish(t, { entity: this });
				}

				// Set values of new entity for provided properties
				if (isNew && properties)
					this.updateWithContext(context, properties);
			});
		}
	}

	private static getSortedPropertyData(properties: ObjectLookup<any>) {
		return entries(properties).sort((a: [string, any], b: [string, any]) => {
			return Number(b[1] instanceof Entity) - Number(a[1] instanceof Entity);
		});
	}

	private init(properties: ObjectLookup<any>, context: InitializationContext): void;
	private init(property: string, context: InitializationContext, value: any): void;
	private init(property: any, context: InitializationContext, value?: any): void {
		if (Entity.ctorDepth === 0) {
			throw new Error("Entity.init() should not be called directly.");
		}

		let properties: ObjectLookup<any>;

		// Convert property/value pair to a property dictionary
		if (typeof property === "string")
			properties = { [property]: value };
		else
			properties = property;

		const initializedProps = new Set<Property>();
		// Initialize the specified properties
		for (const [propName, state] of Entity.getSortedPropertyData(properties)) {
			const prop = this.serializer.resolveProperty(this, propName);
			if (prop && !prop.isCalculated && !prop.isConstant) {
				initializedProps.add(prop);
				const valueResolution = context.tryResolveValue(this, prop, state);
				if (valueResolution)
					valueResolution.then(asyncState => this.initProp(prop, asyncState, context));
				else
					this.initProp(prop, state, context);
			}
		}

		// Pass all unspecified properties through the deserializer to allow initialization logic via converters
		for (const prop of this.meta.type.properties.filter(p => !initializedProps.has(p))) {
			const value = this.serializer.deserialize(this, undefined, prop, context);

			if (value !== undefined)
				Property$init(prop, this, value);
		}
	}

	private initProp(prop: Property, state: any, context: InitializationContext) {
		let value;

		value = this.serializer.deserialize(this, state, prop, context);

		if (value !== undefined)
			Property$init(prop, this, value);
	}

	updateWithContext(context: InitializationContext, state: ObjectLookup<any>) {
		const hadContext = !!this._context;
		// Do not allow reentrant updates of the same entity for a given context
		if (this._context === context)
			return;
		// Don't overwrite existing context
		if (!this._context)
			this._context = context;
		// Ensure provided context waits on the existing context to be ready
		else if (this._context !== context)
			context.wait(this._context.ready);

		this.set(state);

		if (context !== null && !hadContext) {
			context.whenReady(() => {
				this._context = null;
			});
		}
	}

	set(properties: ObjectLookup<any>): void;
	set(property: string, value: any): void;
	set(property: any, value?: any): void {
		let properties: ObjectLookup<any>;

		// Convert property/value pair to a property dictionary
		if (typeof property === "string")
			properties = { [property]: value };
		else
			properties = property;

		// Set the specified properties
		for (let [propName, state] of Entity.getSortedPropertyData(properties)) {
			const prop = this.serializer.resolveProperty(this, propName);
			if (prop && !prop.isCalculated && !prop.isConstant) {
				const valueResolution = this._context ? this._context.tryResolveValue(this, prop, state) : null;
				if (valueResolution)
					valueResolution.then(asyncState => this.setProp(prop, asyncState));
				else
					this.setProp(prop, state);
			}
		}
	}

	private setProp(prop: Property, state: any) {
		let value;
		const currentValue = prop.value(this);
		if (isEntityType(prop.propertyType)) {
			const ChildEntity = prop.propertyType;
			if (prop.isList && Array.isArray(state) && Array.isArray(currentValue)) {
				state.forEach((s, idx) => {
					if (!(s instanceof ChildEntity))
						s = this.serializer.deserialize(this, s, prop, this._context, false);

					// Modifying/replacing existing list item
					if (idx < currentValue.length) {
						// If the item is a state object, create/update the entity using the state 
						if (!(s instanceof ChildEntity) && typeof s === "object") {
							const listItem = currentValue[idx] as Entity;
							// If the entity is a non-pooled type, update in place
							// If the entity id matches the id in the state, update in place
							if (!ChildEntity.meta.identifier || getIdFromState(ChildEntity.meta, s) === listItem.meta.id)
								listItem.updateWithContext(this._context, s);
							else
								currentValue.splice(idx, 1, Type$createOrUpdate(ChildEntity.meta, s, this._context).instance);
						}
						else if (s instanceof ChildEntity)
							currentValue.splice(idx, 1, s);
						else
							console.warn("Provided state,", s, ", is not valid for type " + ChildEntity.meta.fullName + "[].");
					}
					// Add a list item
					else if (s instanceof ChildEntity)
						currentValue.push(s);
					else
						currentValue.push(Type$createOrUpdate(ChildEntity.meta, s, this._context).instance);
				});
			}
			else if (state instanceof ChildEntity)
				value = state;
			else if (state == null)
				value = null;
			else {
				// Attempt to deserialize the state
				let newState = this.serializer.deserialize(this, state, prop, this._context, false);
				if (typeof newState !== "undefined")
					state = newState;
				// Got null, so assign null to the property
				if (state == null)
					value = null;
				// Got a valid instance, so use it
				else if (state instanceof ChildEntity)
					value = state;
				// Got something other than an object, so just use it and expect to get a down-stream error
				else if (typeof state !== "object")
					value = state;
				else if (currentValue && !getIdFromState(ChildEntity.meta, state))
					(currentValue as Entity).updateWithContext(this._context, state);
				// Got an object, so attempt to fetch or create and assign the state
				else
					value = Type$createOrUpdate(ChildEntity.meta, state, this._context).instance;
			}
		}
		else if (prop.isList && Array.isArray(state) && Array.isArray(currentValue))
			currentValue.splice(0, currentValue.length, ...state.map(s => this.serializer.deserialize(this, s, prop, this._context)));
		else
			value = this.serializer.deserialize(this, state, prop, this._context);

		if (value !== undefined)
			Property$setter(prop, this, value);
	}

	get(property: string): any {
		return this.meta.type.getProperty(property).value(this);
	}

	toString(format?: string, formatEval?: (tokenValue: string) => string): string {
		// Get the entity format to use
		let formatter: Format<Entity> = null;
		if (format) {
			formatter = this.meta.type.model.getFormat<Entity>(this.constructor as EntityType, format, formatEval);
		}
		else {
			formatter = this.meta.type.format;
		}

		// Use the formatter, if available, to create the string representation
		if (formatter) {
			return formatter.convert(this);
		}
		else {
			return `${this.meta.type.fullName}|${this.meta.id}`;
		}
	}

	get serializer() {
		return this.meta.type.model.serializer;
	}

	/**
	 * Produces a JSON-valid object representation of the entity.
	 * @param entity
	 */
	serialize(): object {
		return this.serializer.serialize(this);
	}
}

export interface EntityConstructor {
	new(): Entity;
	new(properties?: ObjectLookup<any>): Entity; // Construct new instance with state
}

export interface EntityConstructorForType<TEntity extends Entity> extends EntityConstructor {
	new(): TEntity;
	new(properties?: ObjectLookup<any>): TEntity; // Construct new instance with state
	meta: Type;
}

export interface EntityRegisteredEventArgs {
	entity: Entity;
}

export interface EntityInitNewEventArgs {
	entity: Entity;
}

export interface EntityInitExistingEventArgs {
	entity: Entity;
}

export interface EntityAccessEventHandler {
	(this: Property, args: EventObject & EntityAccessEventArgs): void;
}

export interface EntityAccessEventArgs {
	entity: Entity;
	property: Property;
}

export interface EntityChangeEventHandler {
	(this: Property, args: EventObject & EntityChangeEventArgs): void;
}

export interface EntityChangeEventArgs {
	entity: Entity;
	property: Property;
	oldValue?: any;
	newValue: any;
}
