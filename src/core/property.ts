import { Type } from "./type";
import { Entity } from "./entity";
import { EventDispatcher, IEvent } from "ste-events";
import { getTypeName, getDefaultValue, parseFunctionName } from "./helpers";
import { createSecret } from "./internals";
import { ObservableList } from "./observable-list";

let fieldNamePrefix = createSecret('fieldNamePrefix', 3, false, true, "_fN");

export interface PropertyChangeEventArguments {
	property: Property,
	newValue: any,
	oldValue: any
}

export interface PropertyAccessEventArguments {
	property: Property,
	value: any
}

export class Property {

	readonly containingType: Type;
	readonly name: string;
	readonly jstype: any;
	readonly isList: boolean;
	readonly isStatic: boolean;

	readonly _changedEvent: EventDispatcher<Entity, PropertyChangeEventArguments>;
	readonly _accessedEvent: EventDispatcher<Entity, PropertyAccessEventArguments>;

	// Declare "private" fields
	readonly _origin: string;

	constructor(containingType: Type, name: string, jstype, isList, isStatic) {
		this.containingType = containingType;
		this.name = name;
		this.jstype = jstype;
		this.isList = isList === true;
		this.isStatic = isStatic === true;

		this._changedEvent = new EventDispatcher<Entity, PropertyChangeEventArguments>();
		this._accessedEvent = new EventDispatcher<Entity, PropertyAccessEventArguments>();

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

	get fieldName(): string {
		return fieldNamePrefix + "_" + this.name;
	}

	get changed(): IEvent<Entity, PropertyChangeEventArguments> {
		return this._changedEvent.asEvent();
	}

	get accessed(): IEvent<Entity, PropertyAccessEventArguments> {
		return this._accessedEvent.asEvent();
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
			Property$_setter(this, target, val, false, args);
		} else {
			return Property$_getter(this, target);
		}
	}

	rootedPath(type) {
		if (this.isDefinedBy(type)) {
			return this.isStatic ? this.containingType.fullName + "." + this.name : this.name;
		}
	}

}

export function Property$_generateProperty(property: Property) {

	let type = property.containingType;

	// for static properties add property to javascript type
	// for instance properties add member to all instances of this javascript type via the prototype
    let target = property.isStatic ? type.jstype : type.jstype.prototype;

	Object.defineProperty(target, property.name, {
		configurable: false,
		enumerable: true,
		get: Property$_makeGetter(property, Property$_getter, true),
		set: Property$_makeSetter(property, Property$_setter)
	});

}

export function Property$_init(obj: Entity, property: Property, val: any, force: boolean = false) {
    var target = (property.isStatic ? property.containingType.jstype : obj);
    var curVal = target[property.fieldName];

    if (curVal !== undefined && !(force === undefined || force)) {
        return;
    }

    Object.defineProperty(target, property.fieldName, { value: val, writable: true });

    // TODO
    // target.meta.pendingInit(property, false);

    if (val instanceof Array) {
        val = new ObservableList(obj, val);

        property.changed.subscribe(function (sender, args) {
			/*
			var changes = args.get_changes();

			// Don't raise the change event unless there is actually a change to the collection
			if (changes && changes.some(function (change) { return (change.newItems && change.newItems.length > 0) || (change.oldItems && change.oldItems.length > 0); })) {
				// NOTE: property change should be broadcast before rules are run so that if 
				// any rule causes a roundtrip to the server these changes will be available
				// TODO
				// property.containingType.model.notifyListChanged(target, property, changes);

				// NOTE: oldValue is not currently implemented for lists
				// TODO
				// property._raiseEvent("changed", [target, { property: property, newValue: val, oldValue: undefined, changes: changes, collectionChanged: true }]);

				// TODO
				// Observer.raisePropertyChanged(target, property._name);
			}
			*/
        });

        // Override the default toString on arrays so that we get a comma-delimited list
        // TODO
        // val.toString = Property$_arrayToString.bind(val);
    }

    // TODO
    // Observer.raisePropertyChanged(target, property._name);
}

export function Property$_ensureInited(property: Property, obj: Entity) {
    // Determine if the property has been initialized with a value
    // and initialize the property if necessary
    if (!obj.hasOwnProperty(property.fieldName)) {

        // Do not initialize calculated properties. Calculated properties should be initialized using a property get rule.  
        // TODO
        // if (!property.isCalculated) {
			Property$_init(obj, property, getDefaultValue(property.isList, property.jstype));
        // }

        // TODO
        // Mark the property as pending initialization
        // obj.meta.pendingInit(property, true);
    }
}

export function Property$_getter(property: Property, obj: Entity) {

    // Ensure that the property has an initial (possibly default) value
    Property$_ensureInited(property, obj);

	// Raise get events
	property._accessedEvent.dispatch(obj, { property: property, value: obj[property.fieldName] })

    // Return the property value
    return obj[property.fieldName];
}

export function Property$_setter(property: Property, obj: Entity, val: any, skipTypeCheck: boolean = false, additionalArgs: any = null) {

    // Ensure that the property has an initial (possibly default) value
    Property$_ensureInited(property, obj);

    if (!property.canSetValue(obj, val)) {
        throw new Error("Cannot set " + property.name + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.fullName + "|" + obj.meta.id + ": a value of type " + (property.jstype && property.jstype.meta ? property.jstype.meta.fullName : parseFunctionName(property.jstype)) + " was expected.");
    }

    var old = obj[property.fieldName];

    // Update lists as batch remove/add operations
    if (property.isList) {
        // TODO
        // old.beginUpdate();
        // update(old, val);
        // old.endUpdate();
        throw new Error("Property set on lists is not permitted");
    } else {

        // compare values so that this check is accurate for primitives
        var oldValue = (old === undefined || old === null) ? old : old.valueOf();
        var newValue = (val === undefined || val === null) ? val : val.valueOf();

        // Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
        // not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
        // get this far for Number properties unless the value is actually of type Number (a number or NaN).
        if (oldValue !== newValue && !(property.jstype === Number && isNaN(oldValue) && isNaN(newValue))) {
            // Set the backing field value
            obj[property.fieldName] = val;

            // TODO
            // obj.meta.pendingInit(property, false);

            // Do not raise change if the property has not been initialized. 
            if (old !== undefined) {
                var eventArgs: PropertyChangeEventArguments = { property: property, newValue: val, oldValue: old };

                if (additionalArgs) {
                    for (var arg in additionalArgs) {
                        if (additionalArgs.hasOwnProperty(arg)) {
                            eventArgs[arg] = additionalArgs[arg];
                        }
                    }
                }

                property._changedEvent.dispatch(obj, eventArgs);
            }
        }
    }
}

export function Property$_makeGetter(property: Property, getter: Function, skipTypeCheck: boolean = false) {
    return function () {
        // ensure the property is initialized
        var result = getter(property, this, skipTypeCheck);

        /*
        // TODO
        // ensure the property is initialized
        if (result === undefined || (property.isList && LazyLoader.isRegistered(result))) {
            throw new Error(
                `Property ${property.containingType.fullName}.${} is not initialized.  Make sure instances are loaded before accessing property values.  ${}|${}`);
                ,
                property.name,
                this.meta.type.fullName(),
                this.meta.id
            ));
        }
        */

        // return the result
        return result;
    };
}

export function Property$_makeSetter(prop: Property, setter: Function, skipTypeCheck: boolean = false) {
    // TODO
    // setter.__notifies = true;

    return function (val) {
        setter(prop, this, val, skipTypeCheck);
    };
}
