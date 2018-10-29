import { Model, Model$_allTypesRoot } from "./model";
import { Entity } from "./entity";
import { Property, Property$_generateStaticProperty, Property$_generatePrototypeProperty, Property$_generateOwnProperty } from "./property";
import { navigateAttribute, ensureNamespace, getTypeName, parseFunctionName } from "./helpers";
import { ObjectMeta } from "./object-meta";
import { EventDispatcher, IEvent } from "ste-events";
import { ObservableList } from "./observable-list";

let newIdPrefix = "+c"

export interface TypeEntityInitNewEventArgs {
	entity: Entity;
}

export interface TypeEntityInitExistingEventArgs {
	entity: Entity;
}

export interface TypeEntityDestroyEventArgs {
	entity: Entity;
}

class TypeEventDispatchers {

	readonly initNew: EventDispatcher<Type, TypeEntityInitNewEventArgs>;

	readonly initExisting: EventDispatcher<Type, TypeEntityInitExistingEventArgs>;

	readonly destroy: EventDispatcher<Type, TypeEntityDestroyEventArgs>;

	constructor() {
		this.initNew = new EventDispatcher<Type, TypeEntityInitNewEventArgs>();
		this.initExisting = new EventDispatcher<Type, TypeEntityInitExistingEventArgs>();
		this.initNew = new EventDispatcher<Type, TypeEntityDestroyEventArgs>();
	}

}

export class Type {

	private _counter: number;
	private _jstype: any;
	private _known: ObservableList<Entity>;
	private _pool: { [id: string]: Entity };
	private _legacyPool: { [id: string]: Entity }

	private readonly _properties: { [name: string]: Property };

	model: Model;
	baseType: Type;
	derivedTypes: Type[];
	fullName: string;

	origin: string;
	originForNewProperties: string;

	readonly _eventDispatchers: TypeEventDispatchers;

	constructor(model: Model, name: string, baseType: Type, origin: string) {

		this.model = model;

		this.fullName = name;
	
		Object.defineProperty(this, "_eventDispatchers", { value: new TypeEventDispatchers() });

		this._properties = {};

		// If origin is not provided it is assumed to be client
		this.origin = origin || "client";
		this.originForNewProperties = this.origin;

		this._pool = {};
		this._legacyPool = {};
		this._counter = 0;

		Object.defineProperty(this, "rules", { value: [] });

		// generate class and constructor
		var jstype = Model.getJsType(name, true);

		// create namespaces as needed
		var nameTokens = name.split("."),
			token = nameTokens.shift(),
			namespaceObj = Model$_allTypesRoot,
			globalObj = window;

		while (nameTokens.length > 0) {
			namespaceObj = ensureNamespace(token, namespaceObj);
			globalObj = ensureNamespace(token, globalObj);
			token = nameTokens.shift();
		}

		// the final name to use is the last token
		var finalName = token;
		jstype = Type$_generateClass(this);

		this._jstype = jstype;

		// If the namespace already contains a type with this name, append a '$' to the name
		if (!namespaceObj[finalName]) {
			namespaceObj[finalName] = jstype;
		}
		else {
			namespaceObj['$' + finalName] = jstype;
		}

		// If the global object already contains a type with this name, append a '$' to the name
		if (!globalObj[finalName]) {
			globalObj[finalName] = jstype;
		}
		else {
			globalObj['$' + finalName] = jstype;
		}

		// setup inheritance
		this.derivedTypes = [];

		var baseJsType;

		if (baseType) {
			baseJsType = baseType._jstype;

			this.baseType = baseType;
			baseType.derivedTypes.push(this);

			// TODO
			// inherit all shortcut properties that have aleady been defined
			// inheritBaseTypePropShortcuts(jstype, baseType);
		}
		else {
			baseJsType = Entity;
			this.baseType = null;
		}

		disableConstruction = true;
		this._jstype.prototype = new baseJsType();
		disableConstruction = false;

		this._jstype.prototype.constructor = this._jstype;

		// helpers
		Object.defineProperty(jstype, "meta", { value: this, configurable: false, enumerable: false, writable: false });

		// Register the type with the model
		model._types[name] = this;

		// TODO
		// Add self-reference to decrease the likelihood of errors
		// due to an absence of the necessary type vs. entity.
		// this.type = this;
	}

	get destroyEvent(): IEvent<Type, TypeEntityDestroyEventArgs> {
		return this._eventDispatchers.destroy.asEvent();
	}

	get initNewEvent(): IEvent<Type, TypeEntityInitNewEventArgs> {
		return this._eventDispatchers.initNew.asEvent();
	}

	get initExistingEvent(): IEvent<Type, TypeEntityInitExistingEventArgs> {
		return this._eventDispatchers.initExisting.asEvent();
	}

	static get newIdPrefix() {
		return newIdPrefix.substring(1);
	}

	static set newIdPrefix(value) {
		if (typeof (value) !== "string") throw new TypeError("Property `Type.newIdPrefix` must be a string, found <" + (typeof value) + ">");
		if (value.length === 0) throw new Error("Property `Type.newIdPrefix` cannot be empty string");
		newIdPrefix = "+" + value;
	}

	newId() {
		// Get the next id for this type's heirarchy.
		for (var nextId, type: Type = this; type; type = type.baseType) {
			nextId = Math.max(nextId || 0, type._counter);
		}

		// Update the counter for each type in the heirarchy.
		for (var type: Type = this; type; type = type.baseType) {
			type._counter = nextId + 1;
		}

		// Return the new id.
		return newIdPrefix + nextId;
	}

	register(obj: Entity, id: string, suppressModelEvent: boolean = false) {
		// register is called with single argument from default constructor
		if (arguments.length === 2) {
			Type$_validateId(this, id);
		}

		var isNew: boolean;

		if (!id) {
			id = this.newId();
			isNew = true;
		}

		Object.defineProperty(obj, "meta", { value: new ObjectMeta(this, obj, id, isNew), configurable: false, enumerable: false, writable: false });

		var key = id.toLowerCase();

		for (var t: Type = this; t; t = t.baseType) {
			if (t._pool.hasOwnProperty(key)) {
				throw new Error(`Object \"${this.fullName}|${id}\" has already been registered.`);
			}

			t._pool[key] = obj;

			if (t._known) {
				t._known.add(obj);
			}
		}

		if (this.model._settings.createOwnProperties === true) {
			for (let prop in this._properties) {
				if (Object.prototype.hasOwnProperty.call(this._properties, prop)) {
					let property = this._properties[prop];
					if (!property.isStatic) {
						Property$_generateOwnProperty(property, obj);
					}
				}
			}
		}

		if (!suppressModelEvent) {
			this.model._eventDispatchers.entityRegistered.dispatch(this.model, { entity: obj });
		}
	}

	changeObjectId(oldId, newId) {
		Type$_validateId(this, oldId);
		Type$_validateId(this, newId);

		var oldKey = oldId.toLowerCase();
		var newKey = newId.toLowerCase();

		var obj = this._pool[oldKey];

		if (obj) {
			obj.meta._legacyId = oldId;

			for (var t: Type = this; t; t = t.baseType) {
				t._pool[newKey] = obj;

				delete t._pool[oldKey];

				t._legacyPool[oldKey] = obj;
			}

			obj.meta.id = newId;

			return obj;
		}
		else {
			// TODO
			// logWarning($format("Attempting to change id: Instance of type \"{0}\" with id = \"{1}\" could not be found.", this.get_fullName(), oldId));
			console.warn(`Attempting to change id: Instance of type \"${this.fullName}\" with id = \"${oldId}\" could not be found.`);
		}
	}

	unregister(obj: Entity) {
		for (var t: Type = this; t; t = t.baseType) {
			delete t._pool[obj.meta.id.toLowerCase()];

			if (obj.meta._legacyId) {
				delete t._legacyPool[obj.meta._legacyId.toLowerCase()];
			}

			if (t._known) {
				t._known.remove(obj);
			}
		}

		this.model._eventDispatchers.entityUnregistered.dispatch(this.model, { entity: obj });
	}

	get(id, exactTypeOnly) {
		var key = id.toLowerCase();
		var obj = this._pool[key] || this._legacyPool[key];

		// If exactTypeOnly is specified, don't return sub-types.
		if (obj && exactTypeOnly === true && obj.meta.type !== this) {
			throw new Error(`The entity with id='${id}' is expected to be of type '${this.fullName}' but found type '${obj.meta.type.fullName}'.`);
		}

		return obj;
	}

	// Gets an array of all objects of this type that have been registered.
	// The returned array is observable and collection changed events will be raised
	// when new objects are registered or unregistered.
	// The array is in no particular order.
	known() {
		var known = this._known;
		if (!known) {
			var list: Array<Entity> = [];

			for (var id in this._pool) {
				if (Object.prototype.hasOwnProperty.call(this._pool, id)) {
					list.push(this._pool[id]);
				}
			}

			known = this._known = ObservableList.ensureObservable(list);
		}

		return known;
	}

	get jstype() {
		return this._jstype;
	}

	addProperty(name: string, jstype: any, isList: boolean, isStatic: boolean) {
		/*
		// TODO
		var format = def.format;
		if (format && format.constructor === String) {
			format = getFormat(def.type, format);
		}
		*/

		var property = new Property(this, name, jstype, isList, isStatic);

		this._properties[name] = property;

		// TODO
		// (isStatic ? this._staticProperties : this._instanceProperties)[name] = property;

		/*
		// TODO: Make this an extension?
		// modify jstype to include functionality based on the type definition
		function genPropertyShortcut(mtype, overwrite) {
			var shortcutName = "$" + name;
			if (!(shortcutName in mtype._jstype) || overwrite) {
				mtype._jstype[shortcutName] = property;
			}

			mtype.derivedTypes.forEach(function (t) {
				genPropertyShortcut(t, false);
			});
		}
		genPropertyShortcut(this, true);
		*/

		if (property.isStatic) {
			Property$_generateStaticProperty(property);
		} else if (this.model._settings.createOwnProperties === true) {
			for (var id in this._pool) {
				if (Object.prototype.hasOwnProperty.call(this._pool, id)) {
					Property$_generateOwnProperty(property, this._pool[id]);
			}
			}
		} else {
			Property$_generatePrototypeProperty(property);
		}

		this.model._eventDispatchers.propertyAdded.dispatch(this.model, { property: property });

		return property;
	}

	property(name) {
		var prop;
		for (var t: Type = this; t && !prop; t = t.baseType) {
			prop = t._properties[name];

			if (prop) {
				return prop;
			}
		}
		return null;
	}

	get properties(): Array<Property> {
		let propertiesArray: Array<Property> = [];
		for (var type: Type = this; type != null; type = type.baseType) {
			for (var propertyName in type._properties) {
				if (type._properties.hasOwnProperty(propertyName)) {
					propertiesArray.push(type._properties[propertyName]);
				}
			}
		}
		return propertiesArray;
	}

	isSubclassOf(mtype) {
		var result = false;

		navigateAttribute(this, 'baseType', function (baseType) {
			if (baseType === mtype) {
				result = true;
				return false;
			}
		});

		return result;
	}

	toString() {
		return this.fullName;
	}

}

// TODO: what to do with this?
function Type$_validateId(type: Type, id: string) {
	if (id === null || id === undefined) {
		throw new Error(`Id cannot be ${(id === null ? "null" : "undefined")} (entity = ${type.fullName}).`);
	} else if (getTypeName(id) !== "string") {
		throw new Error(`Id must be a string:  encountered id ${id} of type \"${parseFunctionName(id.constructor)}\" (entity = ${type.fullName}).`);
	} else if (id === "") {
		throw new Error(`Id cannot be a blank string (entity = ${type.fullName}).`);
	}
}

let disableConstruction = false;

function Type$_generateClass(type: Type) {
	function construct(idOrProps, props, suppressModelEvent) {
		if (!disableConstruction) {
			if (idOrProps && idOrProps.constructor === String) {
				var id = idOrProps;

				// When a constructor is called we do not want to silently
				// return an instance of a sub type, so fetch using exact type.
				var exactTypeOnly = true;

				// TODO: Indicate that an object is currently being constructed?

				var obj = type.get(id, exactTypeOnly);

				// If the instance already exists, then initialize properties and return it.
				if (obj) {
					if (props) {
						obj.init(props);
					}
					return obj;
				}

				// Register the newly constructed existing instance.
				type.register(this, id, suppressModelEvent);

				// Initialize properties if provided.
				if (props) {
					this.init(props);
				}

				// Raise the initExisting event on this type and all base types
				for (var t: Type = type; t; t = t.baseType) {
					t._eventDispatchers.initExisting.dispatch(t, { entity: this });
				}
			}
			else {
				// Register the newly constructed new instance. It will
				// be assigned a sequential client-generated id.
				type.register(this, null, suppressModelEvent);

				// Set properties passed into constructor.
				if (idOrProps) {
					this.set(idOrProps);
				}

				// Raise the initNew event on this type and all base types
				for (var t: Type = type; t; t = t.baseType) {
					t._eventDispatchers.initNew.dispatch(t, { entity: this });
				}
			}
		}
	}

	return construct;
}
