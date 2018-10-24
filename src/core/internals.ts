import { Entity } from "./entity";
import { Property, PropertyChangeEventArguments } from "./property";
import { ObservableList } from "./observable-list";
import { getDefaultValue, parseFunctionName } from "./helpers";

export function initializeProperty(obj: Entity, property: Property, val: any, force: boolean = false) {
    var target = (property.isStatic ? property.containingType.jstype : obj);
    var curVal = target[property._fieldName];

    if (curVal !== undefined && !(force === undefined || force)) {
        return;
    }

    target[property._fieldName] = val;

    // TODO
    // target.meta.pendingInit(property, false);

    if (val instanceof Array) {
        val = new ObservableList(obj, val);

        property.changed.subscribe((sender, args) => {
            console.log(arguments);
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

export function ensurePropertyInited(obj: Entity, property: Property) {
    // Determine if the property has been initialized with a value
    // and initialize the property if necessary
    if (!obj.hasOwnProperty(property._fieldName)) {

        // Do not initialize calculated properties. Calculated properties should be initialized using a property get rule.  
        // TODO
        // if (!property.isCalculated) {
        initializeProperty(obj, property, getDefaultValue(property.isList, property.jstype));
        // }

        // TODO
        // Mark the property as pending initialization
        // obj.meta.pendingInit(property, true);
    }
}

export function getPropertyValue(property: Property, obj: Entity) {

    // Ensure that the property has an initial (possibly default) value
    ensurePropertyInited(obj, property);

	/*
	// Raise get events
	var getEvent = property._getEventHandler("get");
	if (getEvent && !getEvent.isEmpty()) {
		getEvent(obj, { property: property, value: obj[property._fieldName] });
	}
	*/

    // Return the property value
    return obj[property._fieldName];
}

export function setPropertyValue(property: Property, obj: Entity, val: any, skipTypeCheck: boolean = false, additionalArgs: any = null) {

    // Ensure that the property has an initial (possibly default) value
    ensurePropertyInited(obj, property);

    if (!property.canSetValue(obj, val)) {
        throw new Error("Cannot set " + property.name + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.fullName + "|" + obj.meta.id + ": a value of type " + (property.jstype && property.jstype.meta ? property.jstype.meta.get_fullName() : parseFunctionName(property.jstype)) + " was expected.");
    }

    var old = obj[property._fieldName];

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
            obj[property._fieldName] = val;

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

export function makePropertyGetter(property: Property, getter: Function, skipTypeCheck: boolean = false) {
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

export function makePropertySetter(prop: Property, setter: Function, skipTypeCheck: boolean = false) {
    // TODO
    // setter.__notifies = true;

    return function (val) {
        setter(prop, this, val, skipTypeCheck);
    };
}
