import { Type } from "./type";
import { Entity } from "./entity";
import { EventDispatcher, IEvent } from "ste-events";
import { getTypeName } from "./helpers";
import { setPropertyValue, getPropertyValue } from "./internals";

export interface PropertyChangeEventArguments {
	property: Property,
	newValue: any,
	oldValue: any
}

export class Property {

	readonly containingType: Type;
	readonly name: string;
	readonly jstype: any;
	readonly isList: boolean;
	readonly isStatic: boolean;

	readonly _changedEvent: EventDispatcher<Entity, PropertyChangeEventArguments>;

	// Declare "private" fields
	readonly _fieldName: string;
	readonly _origin: string;

	constructor(containingType: Type, name: string, jstype, isList, isStatic) {
		this.containingType = containingType;
		this.name = name;
		this.jstype = jstype;
		this.isList = isList === true;
		this.isStatic = isStatic === true;

		this._changedEvent = new EventDispatcher<Entity, PropertyChangeEventArguments>();

		this._fieldName = "_" + name;

		if (containingType.originForNewProperties) {
			this._origin = containingType.originForNewProperties;
		}

		/*
		if (this._origin === "client" && this._isPersisted) {
			// TODO
			// logWarning($format("Client-origin properties should not be marked as persisted: Type = {0}, Name = {1}", containingType.get_fullName(), name));
			console.warn(`Client-origin properties should not be marked as persisted: Type = ${containingType.fullName}, Name = ${name}`);
		}
		*/
	}

	get changed(): IEvent<Entity, PropertyChangeEventArguments> {
		return this._changedEvent.asEvent();
	}

	equals(prop) {
		if (prop !== undefined && prop !== null) {
			if (prop instanceof Property) {
				return this === prop;
			}
			// else if (prop instanceof PropertyChain) {
			// 	var props = prop.all();
			// 	return props.length === 1 && this.equals(props[0]);
			// }
		}
	}

	toString() {
		if (this.isStatic) {
			return this.getPath();
		}
		else {
			return `this<${this.containingType}>.${this.name}`;
		}
	}

	isDefinedBy(mtype) {
		return this.containingType === mtype || mtype.isSubclassOf(this.containingType);
	}

	/*
	get_defaultValue() {
		// clone array and date defaults since they are mutable javascript types
		return this._defaultValue instanceof Array ? this._defaultValue.slice() :
			this._defaultValue instanceof Date ? new Date(+this._defaultValue) :
				this._defaultValue instanceof TimeSpan ? new TimeSpan(this._defaultValue.totalMilliseconds) :
					this._defaultValue instanceof Function ? this._defaultValue() :
						this._defaultValue;
	}
	*/

	get origin(): string {
		return this._origin ? this._origin : this.containingType.origin;
	}

	get fieldName(): string {
		return this._fieldName;
	}

	getPath(): string {
		return this.isStatic ? (this.containingType.fullName + "." + this.name) : this.name;
	}

	canSetValue(obj, val) {
		// NOTE: only allow values of the correct data type to be set in the model

		if (val === undefined) {
			// TODO
			// logWarning("You should not set property values to undefined, use null instead: property = ." + this._name + ".");
			console.warn(`You should not set property values to undefined, use null instead: property = ${this.name}.`);
			return true;
		}

		if (val === null) {
			return true;
		}

		// for entities check base types as well
		if (val.constructor && val.constructor.meta) {
			for (var valType: Type = val.constructor.meta; valType; valType = valType.baseType) {
				if (valType.jstype === this.jstype) {
					return true;
				}
			}

			return false;
		}

		//Data types
		else {
			var valObjectType = val.constructor;

			//"Normalize" data type in case it came from another frame as well as ensure that the types are the same
			switch (getTypeName(val)) {
				case "string":
					valObjectType = String;
					break;
				case "number":
					valObjectType = Number;
					break;
				case "boolean":
					valObjectType = Boolean;
					break;
				case "date":
					valObjectType = Date;
					break;
				case "array":
					valObjectType = Array;
					break;
			}

			// value property type check
			return valObjectType === this.jstype ||

				// entity array type check
				(valObjectType === Array && this.isList && val.every(function (child) {
					if (child.constructor && child.constructor.meta) {
						for (var childType = child.constructor.meta; childType; childType = childType.baseType) {
							if (childType._jstype === this._jstype) {
								return true;
							}
						}

						return false;
					}
				}, this));
		}
	}

	value(obj: Entity, val: any, args: any = null) {
		var target = (this.isStatic ? this.containingType.jstype : obj);

		if (target === undefined || target === null) {
			throw new Error(`Cannot ${(arguments.length > 1 ? "set" : "get")} value for ${(this.isStatic ? "" : "non-")}static property \"${this.getPath()}\" on type \"${this.containingType.fullName}\": target is null or undefined.`)
		}

		if (arguments.length > 1) {
			setPropertyValue(this, target, val, false, args);
		} else {
			return getPropertyValue(this, target);
		}
	}

	rootedPath(type) {
		if (this.isDefinedBy(type)) {
			return this.isStatic ? this.containingType.fullName + "." + this.name : this.name;
		}
	}

}
