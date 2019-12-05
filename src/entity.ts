import { Event, EventObject, EventSubscriber } from "./events";
import { Format } from "./format";
import { Type, EntityType, isEntityType } from "./type";
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

			var isNew: boolean;

			if (typeof id === "string")
				type.assertValidId(id);
			else {
				// Was id provided as undefined, or not provided at all?
				if (arguments.length === 2)
					properties = id;
				id = type.newId();
				isNew = true;
			}

			this.meta = new ObjectMeta(type, this, id, isNew);

			Object.defineProperty(this, "__fields__", { enumerable: false, configurable: false, writable: false, value: {} });

			// Register the newly constructed instance
			type.register(this);

			let isNested = !!context;
			if (!context)
				context = new InitializationContext(true);

			// Initialize existing entity with provided property values
			if (properties && (!isNew || isNested))
				this.init(properties, context);

			// Raise the initNew or initExisting event on this type and all base types
			context.ready(() => {
				for (let t = type; t; t = t.baseType) {
					if (isNew)
						(t.initNew as Event<Type, EntityInitExistingEventArgs>).publish(t, { entity: this });
					else
						(t.initExisting as Event<Type, EntityInitExistingEventArgs>).publish(t, { entity: this });
				}

				// Set values of new entity for provided properties
				if (isNew && properties)
					this.set(properties);
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
		if (typeof property === "string") {
			properties = {};
			properties[property] = value;
		}
		else {
			properties = property;
		}

		const initializedProps = new Set<Property>();
		// Initialize the specified properties
		for (const [propName, state] of Entity.getSortedPropertyData(properties)) {
			const prop = this.serializer.resolveProperty(this, propName);
			if (prop) {
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

		Property$init(prop, this, value);
	}

	set(properties: ObjectLookup<any>): void;
	set(property: string, value: any): void;
	set(property: any, value?: any): void {
		let properties: ObjectLookup<any>;

		// Convert property/value pair to a property dictionary
		if (typeof property === "string") {
			properties = {};
			properties[property] = value;
		}
		else {
			properties = property;
		}

		// Set the specified properties
		for (let [propName, state] of Entity.getSortedPropertyData(properties)) {
			const prop = this.serializer.resolveProperty(this, propName);
			if (prop) {
				let value;
				const currentValue = prop.value(this);
				if (isEntityType(prop.propertyType)) {
					const ChildEntity = prop.propertyType;
					if (prop.isList && Array.isArray(state) && Array.isArray(currentValue)) {
						state.forEach((s, idx) => {
							if (!(s instanceof ChildEntity))
								s = this.serializer.deserialize(this, s, prop, null, false);

							// Modifying/replacing existing list item
							if (idx < currentValue.length) {
								// If the item is an object that has an Id property, then retrieve or create an object with that Id
								if (!(s instanceof ChildEntity) && typeof s === "object" && s.Id && typeof s.Id === "string" && s.Id.length > 0)
									s = ChildEntity.meta.createSync(s);
								if (s instanceof ChildEntity)
									state.splice(idx, 1, s);
								else
									currentValue[idx].set(s);
							}
							// Add a list item
							else if (s instanceof ChildEntity)
								currentValue.push(s);
							else
								currentValue.push(ChildEntity.meta.createSync(s));
						});
					}
					else if (state instanceof ChildEntity)
						value = state;
					else if (state == null)
						value = null;
					else {
						// Attempt to deserialize the state
						let newState = this.serializer.deserialize(this, state, prop, null, false);
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
						// Got an object, so attempt to fetch or create and assign the state
						else if (state.Id && typeof state.Id === "string" && state.Id.length > 0)
							value = ChildEntity.meta.createSync(state);
						else if (currentValue)
							currentValue.set(state);
						else
							value = new ChildEntity(state);
					}
				}
				else if (prop.isList && Array.isArray(state) && Array.isArray(currentValue))
					currentValue.splice(0, currentValue.length, ...state.map(s => this.serializer.deserialize(this, s, prop, null)));
				else
					value = this.serializer.deserialize(this, state, prop, null);

				if (value !== undefined)
					Property$setter(prop, this, value);
			}
		}
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
	new(id: string, properties?: ObjectLookup<any>): Entity; // Construct existing instance with state
	new(properties?: ObjectLookup<any>): Entity; // Construct new instance with state
	new(id?: string | ObjectLookup<any>, properties?: ObjectLookup<any>): Entity;
}

export interface EntityConstructorForType<TEntity extends Entity> extends EntityConstructor {
	new(): TEntity;
	new(id: string, properties?: ObjectLookup<any>): TEntity; // Construct existing instance with state
	new(properties?: ObjectLookup<any>): TEntity; // Construct new instance with state
	new(id?: string | ObjectLookup<any>, properties?: ObjectLookup<any>): TEntity;
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
