import { Type } from "./type";
import { EventDispatcher, IEvent } from "ste-events";
import { Entity } from "./entity";
import { Property } from "./property";

const intrinsicJsTypes = ["Object", "String", "Number", "Boolean", "Date", "TimeSpan", "Array"];

export interface IModelTypeOrNamespace {
	[name: string]: Type | IModelTypeOrNamespace;
}

export interface ModelTypeAddedEventArgs {
	type: Type;
}

export interface ModelEntityRegisteredEventArgs {
	entity: Entity;
}

export interface ModelEntityUnregisteredEventArgs {
	entity: Entity;
}

export interface ModelPropertyAddedEventArgs {
	property: Property;
}

export interface ModelOptions {
	createOwnProperties: Boolean;
}

export interface ModelSettings {
	createOwnProperties: Boolean;
}

const defaultModelSettings: ModelSettings = {
	// There is a slight speed cost to creating own properties,
	// which may be noticeable with very large object counts.
	createOwnProperties: false,
};

class ModelEventDispatchers {

	readonly typeAdded: EventDispatcher<Model, ModelTypeAddedEventArgs>;

	readonly entityRegistered: EventDispatcher<Model, ModelEntityRegisteredEventArgs>;

	readonly entityUnregistered: EventDispatcher<Model, ModelEntityUnregisteredEventArgs>;

	readonly propertyAdded: EventDispatcher<Model, ModelPropertyAddedEventArgs>;

	constructor() {
		this.typeAdded = new EventDispatcher<Model, ModelTypeAddedEventArgs>();
		this.entityRegistered = new EventDispatcher<Model, ModelEntityRegisteredEventArgs>();
		this.entityUnregistered = new EventDispatcher<Model, ModelEntityUnregisteredEventArgs>();
		this.propertyAdded = new EventDispatcher<Model, ModelPropertyAddedEventArgs>();
	}

}

export let Model$_allTypesRoot: IModelTypeOrNamespace = {};

export class Model {

	readonly _types: { [name: string]: Type };

	readonly _settings: ModelSettings;

	readonly _eventDispatchers: ModelEventDispatchers;

	static readonly events: GlobalEventHandlers;

	constructor(options: ModelOptions = null) {
		Object.defineProperty(this, "_types", { value: {} });
		Object.defineProperty(this, "_settings", { value: this.convertOptions(options) });
		Object.defineProperty(this, "_eventDispatchers", { value: new ModelEventDispatchers() });
	}

	private convertOptions(options: ModelOptions = null): ModelSettings {
		// Start with the default settings...
		let settings: ModelSettings = {
			createOwnProperties: defaultModelSettings.createOwnProperties
		};

		if (options) {
			if (Object.prototype.hasOwnProperty.call(options, 'createOwnProperties')) {
				if (typeof options.createOwnProperties === "boolean") {
					settings.createOwnProperties = options.createOwnProperties;
				} else {
					// TODO: warn?
				}
			}
		}

		return settings;
	}

	get typeAddedEvent(): IEvent<Model, ModelTypeAddedEventArgs> {
		return this._eventDispatchers.typeAdded.asEvent();
	}

	get entityRegisteredEvent(): IEvent<Model, ModelEntityRegisteredEventArgs> {
		return this._eventDispatchers.entityRegistered.asEvent();
	}

	get entityUnregisteredEvent(): IEvent<Model, ModelEntityUnregisteredEventArgs> {
		return this._eventDispatchers.entityUnregistered.asEvent();
	}

	get propertyAddedEvent(): IEvent<Model, ModelPropertyAddedEventArgs> {
		return this._eventDispatchers.propertyAdded.asEvent();
	}

	dispose() {
		// TODO
		// for (var key in this._types) {
		// 	delete window[key];
		// }
	}

	get types(): Array<Type> {
		let typesArray: Array<Type> = [];
		for (var typeName in this._types) {
			if (this._types.hasOwnProperty(typeName)) {
				typesArray.push(this._types[typeName]);
			}
		}
		return typesArray;
	}

	addType(name: string, baseType: Type = null, origin: string = "client") {
		var type = new Type(this, name, baseType, origin);
		this._types[name] = type;
		this._eventDispatchers.typeAdded.dispatch(this, { type: type });
		return type;
	}

	/**
	 * Retrieves the JavaScript constructor function corresponding to the given full type name.
	 * @param name The name of the type
	 */
	static getJsType(name: string, allowUndefined: boolean = false): any {
		var obj: IModelTypeOrNamespace = Model$_allTypesRoot;
		var steps = name.split(".");
		if (steps.length === 1 && intrinsicJsTypes.indexOf(name) > -1) {
			return window[name];
		} else {
			for (var i = 0; i < steps.length; i++) {
				var step = steps[i];
				obj = obj[step] as IModelTypeOrNamespace;
				if (obj === undefined) {
					if (allowUndefined) {
						return;
					} else {
						throw new Error(`The type \"${name}\" could not be found.  Failed on step \"${step}\".`);
					}
				}
			}
			return obj;
		}
	}
}
