import { Model } from "./model";
import { Entity, EntityConstructorForType, EntityInitNewEventArgs, EntityInitExistingEventArgs, EntityRegisteredEventArgs, EntityConstructor } from "./entity";
import { Property, PropertyOptions, Property$generateOwnProperty, Property$generatePrototypeProperty, Property$generateShortcuts } from "./property";
import { navigateAttribute, getTypeName, parseFunctionName, ensureNamespace, getGlobalObject, entries } from "./helpers";
import { Event, EventSubscriber } from "./events";
import { ObservableArray } from "./observable-array";
import { RuleOptions, Rule } from "./rule";
import { Format } from "./format";
import { PropertyChain } from "./property-chain";
import { PropertyPath } from "./property-path";
import { InitializationContext, InitializationValueResolver } from "./initilization-context";

export const Type$newIdPrefix = "+c";

export class Type {
	format: Format<Entity>;

	// Public read-only properties: aspects of the object that cannot be
	// changed without fundamentally changing what it represents
	readonly model: Model;
	readonly fullName: string;
	readonly jstype: EntityType;
	readonly baseType: Type;
	readonly derivedTypes: Type[];

	private _identifier: Property;

	// Backing fields for properties that are settable and also derived from
	// other data, calculated in some way, or cannot simply be changed
	private _lastId: number;

	private readonly __known__: ObservableArray<Entity>;
	private readonly __pool__: { [id: string]: Entity };
	private readonly __properties__: { [name: string]: Property };

	private readonly _chains: { [path: string]: PropertyChain };

	readonly _formats: { [name: string]: Format<any> };

	readonly initNew: EventSubscriber<Type, EntityInitNewEventArgs>;
	readonly initExisting: EventSubscriber<Type, EntityInitExistingEventArgs>;
	// readonly conditionsChanged: EventSubscriber<Type, ConditionTargetsChangedEventArgs>;

	constructor(model: Model, fullName: string, baseType: Type = null, format: string | Format<Entity>, options?: TypeExtensionOptions<Entity>) {
		this.model = model;
		this.fullName = fullName;
		this.jstype = Type$generateConstructor(this, fullName, baseType, model.settings.useGlobalObject ? getGlobalObject() : null);
		this.baseType = baseType;
		this.derivedTypes = [];
		this._identifier = null;

		Object.defineProperty(this, "__pool__", { enumerable: false, configurable: false, writable: false, value: {} });
		Object.defineProperty(this, "__properties__", { enumerable: false, configurable: false, writable: false, value: {} });

		Object.defineProperty(this, "_lastId", { enumerable: false, configurable: false, writable: true, value: 0 });
		Object.defineProperty(this, "_formats", { enumerable: false, configurable: false, writable: true, value: {} });
		Object.defineProperty(this, "_chains", { enumerable: false, configurable: false, writable: true, value: {} });

		if (baseType) {
			baseType.derivedTypes.push(this);
		}

		this.initNew = new Event<Type, EntityInitNewEventArgs>();
		this.initExisting = new Event<Type, EntityInitExistingEventArgs>();
		// this.conditionsChanged = new Event<Type, ConditionTargetsChangedEventArgs>();

		// Set Format
		if (format) {
			if (typeof (format) === "string") {
				this.model.ready(() => {
					this.format = this.model.getFormat<Entity>(this.jstype, format);
				});
			}
			else
				this.format = format;
		}

		// Apply type options
		if (options)
			this.extend(options);
	}

	get identifier() {
		if (this._identifier)
			return this._identifier;
		return this.baseType ? this.baseType.identifier : null;
	}

	set identifier(val) {
		this._identifier = val;
	}

	createSync(state: any): Entity {
		// Attempt to fetch an existing instance if the state contains an Id property
		const id = getIdFromState(this, state);
		if (id) {
			const instance = this.get(id);
			if (instance) {
				// Assign state to the existing object
				instance.set(state);
				return instance;
			}
			const Ctor = this.jstype as any;
			// Construct an instance using the known id
			return new Ctor(id, state);
		}
		// Construct a new instance without a known id
		return new this.jstype(state);
	}

	create(state: any, valueResolver?: InitializationValueResolver): Promise<Entity> {
		// Attempt to fetch an existing instance if the state contains an Id property
		const { context, instance } = Type$createOrUpdate(this, state, valueResolver);
		return new Promise(resolve => context.ready(() => resolve(instance)));
	}

	/** Generates a unique id suitable for an instance in the current type hierarchy. */
	newId(): string {
		let lastId: number;
		for (let type: Type = this; type; type = type.baseType) {
			lastId = Math.max(lastId || 0, type._lastId);
		}

		let nextId = lastId + 1;

		// Update the last id for each type in the heirarchy.
		for (let type: Type = this; type; type = type.baseType) {
			type._lastId = nextId;
		}

		// Return the new id.
		return Type$newIdPrefix + nextId;
	}

	assertValidId(id: string): void {
		if (id === null || id === undefined) {
			throw new Error(`Id cannot be ${(id === null ? "null" : "undefined")} (entity = ${this.fullName}).`);
		}
		else if (getTypeName(id) !== "string") {
			throw new Error(`Id must be a string:  encountered id ${id} of type "${parseFunctionName(id.constructor)}" (entity = ${this.fullName}).`);
		}
		else if (id === "") {
			throw new Error(`Id cannot be a blank string (entity = ${this.fullName}).`);
		}
	}

	register(obj: Entity): void {
		this.assertValidId(obj.meta.id);

		var key = obj.meta.id.toLowerCase();

		for (var t: Type = this; t; t = t.baseType) {
			if (t.__pool__.hasOwnProperty(key)) {
				throw new Error(`Object "${this.fullName}|${obj.meta.id}" has already been registered.`);
			}

			t.__pool__[key] = obj;

			if (t.__known__) {
				t.__known__.push(obj);
			}
		}

		if (this.model.settings.createOwnProperties === true) {
			for (let prop in this.__properties__) {
				if (Object.prototype.hasOwnProperty.call(this.__properties__, prop)) {
					let property = this.__properties__[prop];
					Property$generateOwnProperty(property, obj);
				}
			}
		}

		(this.model.entityRegistered as Event<Model, EntityRegisteredEventArgs>).publish(this.model, { entity: obj });
	}

	changeObjectId(oldId: string, newId: string): Entity | void {
		this.assertValidId(oldId);
		this.assertValidId(newId);

		var oldKey = oldId.toLowerCase();
		var newKey = newId.toLowerCase();

		if (this.__pool__[newKey]) {
			throw new Error(`Entity '${this.fullName}|${newKey}' is already registered.`);
		}

		var obj = this.__pool__[oldKey];

		if (!obj) {
			// TODO: Throw error or warn when attempting to change an object Id that is unknown?
			return;
		}

		for (var t: Type = this; t; t = t.baseType) {
			t.__pool__[newKey] = obj;
		}

		obj.meta.id = newId;
		obj.meta.isNew = false;

		return obj;
	}

	get(id: string, exactTypeOnly: boolean = false): Entity {
		if (!id) {
			throw new Error(`Method "${this.fullName}.meta.get()" was called without a valid id argument.`);
		}

		var key = id.toLowerCase();
		var obj = this.__pool__[key];

		// If exactTypeOnly is specified, don't return sub-types.
		if (obj && exactTypeOnly === true && obj.meta.type !== this) {
			throw new Error(`The entity with id='${id}' is expected to be of type '${this.fullName}' but found type '${obj.meta.type.fullName}'.`);
		}

		return obj;
	}

	// Gets an array of all objects of this type that have been registered.
	// The returned array is observable and collection changed events will be raised
	// when new objects are registered.
	// The array is in no particular order.
	known(): Entity[] {
		var known = this.__known__;
		if (!known) {
			var list: Entity[] = [];

			for (var id in this.__pool__) {
				if (Object.prototype.hasOwnProperty.call(this.__pool__, id)) {
					list.push(this.__pool__[id]);
				}
			}

			known = ObservableArray.ensureObservable(list);

			Object.defineProperty(this, "__known__", { enumerable: false, configurable: false, writable: false, value: known });
		}

		return known;
	}

	getProperty(name: string): Property {
		var prop;
		for (var t: Type = this; t && !prop; t = t.baseType) {
			prop = t.__properties__[name];

			if (prop) {
				return prop;
			}
		}
		return null;
	}

	/** Gets the {Property} or {PropertyChain} for the specified simple path {string}. */
	getPath(path: string): PropertyPath {
		// Get single property
		let property: PropertyPath = this.getProperty(path);

		// Get cached property chain
		if (!property)
			property = this._chains[path];

		// Create and cache property chain
		if (!property) {
			property = this._chains[path] = new PropertyChain(this, path);
		}

		// Return the property path
		return property;
	}

	/** Gets and array of {Property} or {PropertyChain} instances for the specified complex graph path {string}. */
	getPaths(path: string): PropertyPath[] {
		let start = 0;
		let paths = [];

		// Process the path
		if (/{|,|}/g.test(path)) {
			let stack: string[] = [];
			let parent: string;

			for (let i = 0, len = path.length; i < len; ++i) {
				let c = path.charAt(i);

				if (c === "{" || c === "," || c === "}") {
					let seg = path.substring(start, i).trim();
					start = i + 1;

					if (c === "{") {
						if (parent) {
							stack.push(parent);
							parent += "." + seg;
						}
						else {
							parent = seg;
						}
					}
					else { // ',' or '}'
						if (seg.length > 0) {
							paths.push(this.getPath(parent ? parent + "." + seg : seg));
						}

						if (c === "}") {
							parent = (stack.length === 0) ? undefined : stack.pop();
						}
					}
				}
			}

			if (stack.length > 0 || parent) {
				throw new Error("Unclosed '{' in path: " + path);
			}

			if (start < path.length) {
				let seg = path.substring(start).trim();
				if (seg.length > 0) {
					paths.push(this.getPath(seg));
				}

				// Set start to past the end of the list to indicate that the entire string was processed
				start = path.length;
			}
		}

		// If the input is a simple property or path, then add the single property or chain
		if (start === 0) {
			paths.push(this.getPath(path.trim()));
		}

		return paths;
	}

	get properties(): Property[] {
		let propertiesArray: Property[] = [];
		for (var type: Type = this; type != null; type = type.baseType) {
			for (var propertyName in type.__properties__) {
				if (type.__properties__.hasOwnProperty(propertyName)) {
					propertiesArray.push(type.__properties__[propertyName]);
				}
			}
		}
		return propertiesArray;
	}

	addRule(optionsOrFunction: ((this: Entity) => void) | RuleOptions): Rule {
		let options: RuleOptions;

		if (optionsOrFunction) {
			// The options are the function to execute
			if (optionsOrFunction instanceof Function) {
				options = { execute: optionsOrFunction };
			}
			else {
				options = optionsOrFunction as RuleOptions;
			}
		}

		let rule = new Rule(this, options.name, options);

		// TODO: Track rules on the type?

		return rule;
	}

	hasModelProperty(prop: Property): boolean {
		return prop.containingType === this || this.isSubclassOf(prop.containingType as Type);
	}

	isSubclassOf(type: Type): boolean {
		var result = false;

		navigateAttribute(this, "baseType", function (baseType: Type) {
			if (baseType === type) {
				result = true;
				return false;
			}
		});

		return result;
	}

	toString(): string {
		return this.fullName;
	}

	/**
	 * Extends the current type with the specified format, properties and methods
	 * @param options The options specifying how to extend the type
	 */
	extend(options: TypeExtensionOptions<Entity>): void {
		let type = this;

		// Utility function to convert a path string into a resolved array of Property and PropertyChain instances
		function resolveDependsOn(rule: string, dependsOn: string): PropertyPath[] {
			// return an empty dependency array if no path was specified
			if (!dependsOn)
				return [];

			// throw an exception if dependsOn is not a string
			if (typeof (dependsOn) !== "string")
				throw new Error(`Invalid dependsOn property for '${rule}' rule on '${type}.`);

			// get the property paths for the specified dependency string
			return type.getPaths(dependsOn);
		}

		// Use prepare() to defer property path resolution while the model is being extended
		this.model.prepare(() => {
			const isRuleMethod = (value: any): value is RuleOrMethodOptions<Entity> => value.hasOwnProperty("function");

			// Type Members
			for (let [name, member] of entries(options)) {
				if (name.startsWith("$"))
					continue;

				// Ignore Type and Format values, which do not represent type members
				if (member instanceof Type || member instanceof Format)
					continue;

				// Property Type Name
				if (typeof (member) === "string")
					member = { type: member };

				// Property Type
				else if (isValueType(member))
					member = { type: member };

				// Non-Rule Method/Function
				if (typeof (member) === "function") {
					Type$generateMethod(this, this.jstype.prototype, name, member);
				}

				// Rule Method
				else if (isRuleMethod(member)) {
					Type$generateMethod(this, this.jstype.prototype, name, member.function);
					this.model.ready(() => {
						new Rule(this, this.fullName + "." + name + "Rule", {
							execute: (new Function(`return this.${name}();`)) as (this: Entity) => void,
							onChangeOf: resolveDependsOn("get", member.dependsOn)
						}).register();
					});
				}

				// Property
				else {
					member = { ...member };

					// Get Property
					let property = this.getProperty(name);

					// Add Property
					if (!property) {
						// Type & IsList
						let isList = false;
						if (typeof (member.type) === "string") {
							let typeName = member.type;
							// Type names ending in [] are lists
							if (typeName.lastIndexOf("[]") === (typeName.length - 2)) {
								isList = true;
								typeName = typeName.substr(0, typeName.length - 2);
							}

							// Convert type names to javascript types
							member.type = this.model.getJsType(typeName);

							// Warn if the type couldn't be found
							if (!member.type && window.console && console.warn) {
								console.warn(`Could not resolve type '${typeName}.`);
							}
						}

						const isIdentifier = member.identifier === true;

						// Add Property
						let property = new Property(this, name, member.type, isIdentifier, isList, member);

						if (isIdentifier) {
							this.identifier = property;
						}

						this.__properties__[name] = property;

						Property$generateShortcuts(property, this.jstype);

						if (!this.model.settings.createOwnProperties) {
							Property$generatePrototypeProperty(property, this.jstype.prototype);
						}
					}
					else {
						property.extend(member, this);
					}
				}
			}
		});
	}
}

export function Type$createOrUpdate(type: Type, state: any, contextOrResolver: InitializationValueResolver | InitializationContext) {
	const id = getIdFromState(type, state);
	const isNew = !id;
	let context: InitializationContext;
	if (contextOrResolver instanceof InitializationContext)
		context = contextOrResolver;
	else
		context = new InitializationContext(isNew, contextOrResolver);

	let instance = id && type.get(id);
	if (instance) {
		// Assign state to the existing object
		instance.withContext(context, () => instance.set(state));
	}
	else {
		// Cast the jstype to any so we can call the internal constructor signature that takes a context
		// We don't want to put the context on the public constructor interface
		const Ctor = type.jstype as any;
		// Construct an instance using the known id if it is present
		instance = (id ? new Ctor(id, state, context) : new Ctor(state, context)) as Entity;
	}
	return { context, instance };
}

export type Value = string | number | Date | boolean;
export type ValueType = StringConstructor | NumberConstructor | DateConstructor | BooleanConstructor;
export type EntityType = EntityConstructorForType<Entity>;
export type PropertyType = ValueType | EntityType | ObjectConstructor;

export interface TypeConstructor {
	new(model: Model, fullName: string, baseType?: Type, origin?: string): Type;
}

export interface TypeOptions {
	$extends?: string;
	$format?: string | Format<Entity>;
}

export interface RuleOrMethodOptions<TEntity extends Entity> {
	function: (this: TEntity, ...args: any[]) => any;
	dependsOn?: PropertyPath[];
}

export type RuleOrMethodFunctionOrOptions<EntityType extends Entity> = ((this: EntityType, ...args: any[]) => any) | RuleOrMethodOptions<EntityType>;

export interface TypeExtensionOptions<EntityType extends Entity> {
	[name: string]: string | ValueType | PropertyOptions | RuleOrMethodFunctionOrOptions<EntityType>;
}

export function isValueType(type: any): type is ValueType {
	return type === String || type === Number || type === Date || type === Boolean;
}

export function isValue<T = Value | string | number | Date | boolean>(value: any, type: ValueType = null): value is T {
	if (value == null)
		return false;

	let valueType = value.constructor;

	if (type != null)
		return valueType === type;

	return isValueType(valueType);
}

export function isValueArray(value: any): value is Value[] {
	if (value == null)
		return false;
	if (!Array.isArray(value))
		return false;
	if (value.length === 0)
		return true;

	let item = value[0];
	if (item == null)
		return false;

	let itemType = item.constructor;
	return isValueType(itemType);
}

export function isEntityType(type: any): type is EntityType {
	return type.meta && type.meta instanceof Type;
}

export function getIdFromState(type: Type, state: any): string | undefined {
	if (type.identifier && typeof state === "object") {
		const id: any = state[type.identifier.name];
		if (id && typeof id === "string" && id.length > 0)
			return id;
	}
}

export function Type$generateMethod(type: Type, target: any, name: string, fn: Function): void {
	target[name] = fn;
}

// TODO: Get rid of disableConstruction?
let disableConstruction = false;

export function Type$generateConstructor(type: Type, fullName: string, baseType: Type = null, global: any = null): EntityConstructorForType<Entity> {
	// Create namespaces as needed
	let nameTokens: string[] = fullName.split(".");
	let token: string = nameTokens.shift();
	let namespaceObj: any = type.model.$namespace || type.model;
	let namespacePrefix = "";
	let globalObj: any = global;

	while (nameTokens.length > 0) {
		namespacePrefix = namespacePrefix + token + ".";
		namespaceObj = ensureNamespace(token, namespaceObj);
		if (global) {
			globalObj = ensureNamespace(token, globalObj);
		}
		token = nameTokens.shift();
	}

	// The final name to use is the last token
	let finalName = token;

	let BaseConstructor: EntityConstructor;

	if (baseType) {
		BaseConstructor = baseType.jstype;
		// // TODO: Implement `inheritBaseTypePropShortcuts`
		// // inherit all shortcut properties that have aleady been defined
		// inheritBaseTypePropShortcuts(ctor, baseType);
	}
	else {
		BaseConstructor = Entity;
	}

	let ctorFactory = new Function("construct", "return function " + finalName + " () { construct.apply(this, arguments); }");

	function construct(this: Entity): void {
		if (!disableConstruction) {
			try {
				Entity.ctorDepth++;
				const args = Array.from(arguments);
				if (!(args[0] instanceof Type))
					args.unshift(type);
				BaseConstructor.apply(this, args);
			}
			finally {
				Entity.ctorDepth--;
			}
		}
	}

	let ctor = ctorFactory(construct) as any;

	let namespaceKey = finalName;

	// If the namespace already contains a type with this name, prepend a '$' to the name
	while (namespaceObj[namespaceKey]) {
		if (process.env.NODE_ENV === "development") {
			console.warn("Namespace path '" + namespacePrefix + namespaceKey + "' is already assigned.");
		}
		namespaceKey = "$" + namespaceKey;
	}

	namespaceObj[namespaceKey] = ctor;

	if (global) {
		let globalKey = finalName;

		// If the global object already contains a type with this name, append a '$' to the name
		while (globalObj[globalKey]) {
			if (process.env.NODE_ENV === "development") {
				console.warn("Global path '" + namespacePrefix + globalKey + "' is already assigned.");
			}
			globalKey = "$" + globalKey;
		}

		globalObj[globalKey] = ctor;
	}

	// Setup inheritance

	disableConstruction = true;

	ctor.prototype = new BaseConstructor();

	disableConstruction = false;

	ctor.prototype.constructor = ctor;

	// Add the 'meta' helper
	Object.defineProperty(ctor, "meta", { enumerable: false, value: type, configurable: false, writable: false });

	return ctor;
}
