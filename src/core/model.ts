import { Type } from "./type";
import { EventDispatcher, IEvent } from "ste-events";
import { Entity } from "./entity";
import { PropertyCreationTarget } from "./property";

const intrinsicJsTypes = ["Object", "String", "Number", "Boolean", "Date", "TimeSpan", "Array"];

export interface IModelTypeOrNamespace {
	[name: string]: Type | IModelTypeOrNamespace;
}

export interface ModelTypeAddedEventArguments {
	type: Type;
}

export interface ModelEntityRegisteredEventArguments {
	entity: Entity;
}

export interface ModelEntityUnregisteredEventArguments {
	entity: Entity;
}

export interface ModelOptions {
	propertyTarget: PropertyCreationTarget | string;
}

export interface ModelSettings {
	propertyTarget: PropertyCreationTarget;
}

export class Model {

	static readonly _allTypesRoot: IModelTypeOrNamespace = {};

	readonly _types: { [name: string]: Type };

	readonly _settings: ModelSettings;

	readonly _typeAddedEvent: EventDispatcher<Model, ModelTypeAddedEventArguments>;

	readonly _entityRegisteredEvent: EventDispatcher<Model, ModelEntityRegisteredEventArguments>;

	readonly _entityUnregisteredEvent: EventDispatcher<Model, ModelEntityUnregisteredEventArguments>;

	constructor(options: ModelOptions = null) {
		this._types = {};
		this._settings = Model.convertOptions(options);
		this._typeAddedEvent = new EventDispatcher<Model, ModelTypeAddedEventArguments>();
		this._entityRegisteredEvent = new EventDispatcher<Model, ModelEntityRegisteredEventArguments>();
		this._entityUnregisteredEvent = new EventDispatcher<Model, ModelEntityUnregisteredEventArguments>();
	}

	private static convertOptions(options: ModelOptions = null): ModelSettings {
		let settings = { propertyTarget: PropertyCreationTarget.PrototypeWithBackingField };

		if (options) {
			if (options.propertyTarget) {
				if (typeof options.propertyTarget === "number") {
					settings.propertyTarget = options.propertyTarget as PropertyCreationTarget;
				} else if (typeof options.propertyTarget === "string") {
					let propertyTargetString = options.propertyTarget.toLowerCase();
					if (propertyTargetString === PropertyCreationTarget[PropertyCreationTarget.PrototypeWithBackingField].toLowerCase()) {
						settings.propertyTarget = PropertyCreationTarget.PrototypeWithBackingField;
					} else if (propertyTargetString === PropertyCreationTarget[PropertyCreationTarget.DirectlyOnObject].toLowerCase()) {
						settings.propertyTarget = PropertyCreationTarget.DirectlyOnObject;
					}
				} else {

				}
			}
		}

		return settings;
	}

	get typeAdded(): IEvent<Model, ModelTypeAddedEventArguments> {
		return this._typeAddedEvent.asEvent();
	}

	get entityRegistered(): IEvent<Model, ModelEntityRegisteredEventArguments> {
		return this._entityRegisteredEvent.asEvent();
	}

	get entityUnregistered(): IEvent<Model, ModelEntityUnregisteredEventArguments> {
		return this._entityUnregisteredEvent.asEvent();
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
		this._typeAddedEvent.dispatch(this, { type: type });
		return type;
	}

	/**
	 * Retrieves the JavaScript constructor function corresponding to the given full type name.
	 * @param name The name of the type
	 */
	static getJsType(name: string, allowUndefined: boolean = false): any {
		var obj: IModelTypeOrNamespace = Model._allTypesRoot;
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
