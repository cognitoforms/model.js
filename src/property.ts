import { Event, EventSubscriber, EventPublisher } from "./events";
import { Entity, EntityChangeEventArgs, EntityAccessEventArgs } from "./entity";
import { Format } from "./format";
import { Type, PropertyType, isEntityType, Value, isValue, isValueArray } from "./type";
import { PropertyChain } from "./property-chain";
import { getTypeName, getDefaultValue, parseFunctionName, ObjectLookup, merge, getConstructorName, isType, flatMap } from "./helpers";
import { ObservableArray, updateArray } from "./observable-array";
import { Rule, RuleOptions } from "./rule";
import { CalculatedPropertyRule } from "./calculated-property-rule";
import { StringFormatRule } from "./string-format-rule";
import { ValidationRule } from "./validation-rule";
import { AllowedValuesRule } from "./allowed-values-rule";
import { RequiredRule } from "./required-rule";
import { PropertyPath, PropertyAccessEventArgs, PropertyChangeEventArgs } from "./property-path";
import { RangeRule } from "./range-rule";
import { StringLengthRule } from "./string-length-rule";
import { ListLengthRule } from "./list-length-rule";
import { InitializationContext } from "./initilization-context";
import { ConditionType, ErrorConditionType } from "./condition-type";

export class Property implements PropertyPath {
	readonly containingType: Type;
	readonly name: string;
	readonly propertyType: PropertyType;
	readonly isIdentifier: boolean;
	readonly isList: boolean;

	constant: any;
	initializer: (this: Entity) => any;
	label: string;
	labelSource: PropertyPath;
	helptext: string;
	isCalculated: boolean;
	format: Format<any>;
	required: boolean | PropertyBooleanFunction | PropertyBooleanFunctionAndOptions;

	private _defaultValue: any;

	readonly rules: PropertyRule[];

	readonly getter: (args?: any) => any;
	readonly setter: (value: any, args?: any) => void;

	readonly changed: EventSubscriber<Entity, PropertyChangeEventArgs>;
	readonly accessed: EventSubscriber<Entity, PropertyAccessEventArgs>;

	constructor(containingType: Type, name: string, propertyType: PropertyType, isIdentifier: boolean, isList: boolean, options?: PropertyOptions) {
		this.containingType = containingType;
		this.name = name;
		this.propertyType = propertyType;
		this.isIdentifier = isIdentifier;
		this.isList = isList;
		this.required = false;
		this.rules = [];
		this.getter = Property$makeGetter(this, Property$getter);
		this.setter = Property$makeSetter(this, Property$setter);
		this.changed = new Event<Entity, PropertyChangeEventArgs>();
		this.accessed = new Event<Entity, PropertyAccessEventArgs>();

		// Apply property options
		if (options)
			this.extend(options);
	}

	get isConstant(): boolean {
		return this.constant !== null && this.constant !== undefined;
	}

	get labelIsFormat(): boolean {
		return Format.hasTokens(this.label);
	}

	get helptextIsFormat(): boolean {
		return Format.hasTokens(this.helptext);
	}

	get path(): string {
		return this.name;
	}

	get firstProperty(): Property {
		return this;
	}

	get lastProperty(): Property {
		return this;
	}

	getLastTarget(obj: Entity): Entity {
		return obj;
	}

	get defaultValue(): any {
		if (this._defaultValue !== undefined) {
			// clone array and date defaults since they are mutable javascript types
			return this._defaultValue instanceof Array ? this._defaultValue.slice() :
				this._defaultValue instanceof Date ? new Date(+this._defaultValue) :
					// TODO: Implement TimeSpan class/type?
					// this._defaultValue instanceof TimeSpan ? new TimeSpan(this._defaultValue.totalMilliseconds) :
					this._defaultValue;
		}
		else
			return getDefaultValue(this.isList, this.propertyType);
	}

	extend(options: PropertyOptions, targetType?: Type): void {
		if (!targetType)
			targetType = this.containingType;

		// Utility function to convert a path string into a resolved array of Property and PropertyChain instances
		function resolveDependsOn(property: Property, rule: string, dependsOn: string): PropertyPath[] {
			// return an empty dependency array if no path was specified
			if (!dependsOn)
				return [];

			// throw an exception if dependsOn is not a string
			if (typeof (dependsOn) !== "string")
				throw new Error(`Invalid dependsOn property for '${rule}' rule on '${property}.`);

			// get the property paths for the specified dependency string
			return targetType.getPaths(dependsOn);
		}

		// Use prepare() to defer property path resolution while the model is being extended
		targetType.model.prepare(() => {
			options = { ...options };

			// Label
			if (options.label)
				this.label = options.label;
			else if (targetType.model.settings.autogeneratePropertyLabels && !this.label)
				this.label = this.name.replace(/(^[a-z]+|[A-Z]{2,}(?=[A-Z][a-z]|$)|[A-Z][a-z]*)/g, " $1").trim();

			// Label Source
			if (options.labelSource) {
				if (typeof (options.labelSource) !== "string")
					throw new Error(`Invalid labelSource property for '${this}.`);

				targetType.model.ready(() => {
					this.labelSource = targetType.getPath(options.labelSource);
				});
			}

			// Helptext
			this.helptext = options.helptext;

			// Format
			if (options.format) {
				// Specifier
				if (typeof (options.format) === "string") {
					let format = options.format;
					this.format = targetType.model.getFormat(this.propertyType, format);
				}

				// Format
				else if (options.format instanceof Format) {
					// TODO: convert description/expression/reformat into a Format object
					this.format = options.format;
				}

				// String Format
				else if (isType<PropertyFormatOptions>(options.format, (f: any) => getTypeName(f) === "object" && f.expression)) {
					let format = options.format;
					targetType.model.ready(() => {
						new StringFormatRule(targetType, {
							property: this,
							description: format.description,
							message: format.message,
							expression: format.expression,
							reformat: format.reformat
						})
							.register();
					});
				}

				// Error
				else {
					throw new Error(`Invalid 'format' option for '${this}'.`);
				}
			}

			// Constant
			if (options.constant !== null && options.constant !== undefined) {
				targetType.model.ready(() => {
					// Lazily obtain the constant to ensure all types/rules associated with the constant value have been loaded and initialized
					this.constant = () => targetType.model.serializer.deserialize(null, options.constant, this, new InitializationContext(true));
				});
			}

			// Get
			if (options.get) {
				if (typeof (options.get) === "function") {
					options.get = { function: options.get, dependsOn: "" };
				}

				if (isPropertyOptions(options.get)) {
					let getOptions = options.get;

					if (typeof (getOptions.function) !== "function") {
						throw new Error(`Invalid property 'get' function of type '${getTypeName(getOptions.function)}'.`);
					}

					targetType.model.ready(() => {
						new CalculatedPropertyRule(targetType, null, {
							property: this,
							calculate: getOptions.function,
							onChangeOf: resolveDependsOn(this, "get", getOptions.dependsOn)
						}).register();
					});
				}
				else {
					throw new Error(`Invalid property 'get' option of type '${getTypeName(options.get)}'.`);
				}
			}

			// Set
			if (typeof options.set === "function") {
				const property = this;
				this.changed.subscribe(function(e) { options.set.call(this, e.newValue); });
				new Rule(targetType, null, {
					onInit: true,
					execute() {
						options.set.call(this, property.value(this));
					}
				}).register();
			}

			// Init
			if (options.init !== undefined) {
				let initFn: (this: Entity) => any;
				if (isPropertyValueFunction<any>(options.init)) {
					initFn = options.init;
				}
				else if (isValue(options.init) || isValueArray(options.init)) {
					initFn = () => options.init;
				}
				else {
					throw new Error(`Invalid property 'init' option of type '${getTypeName(options.init)}'.`);
				}

				const property = this;
				this.initializer = function () {
					return targetType.model.serializer.deserialize(this, initFn.call(this), property, new InitializationContext(true));
				};
			}

			// Default
			if (options.default !== undefined) {
				if (isPropertyValueFunction<any>(options.default)) {
					// Always generate a rule for default function
					options.default = { function: options.default, dependsOn: "" };
				}
				else if (isPropertyOptions<PropertyValueFunctionAndOptions<any>>(options.default)) {
					// Use default object as specified
				}
				else if (options.default === null || isValue(options.default) || isValueArray(options.default)) {
					// Constant
					let defaultConstant: Value | Value[] = options.default;

					// Cannot set default constant value for entity-typed property
					if (isEntityType(this.propertyType)) {
						throw new Error(`Cannot set a constant default value for a property of type '${this.propertyType.meta.fullName}'.`);
					}

					// Verify that the constant value is of the proper built-in type
					if (options.default !== null && isValue(options.default)) {
						let defaultOptionTypeName = getTypeName(defaultConstant);
						let propertyTypeName = getConstructorName(this.propertyType).toLowerCase();
						if (defaultOptionTypeName !== propertyTypeName) {
							throw new Error(`Cannot set a default value of type '${defaultOptionTypeName}' for a property of type '${propertyTypeName}'.`);
						}
					}

					// If extending baseType property specifically for a child type, use a rule
					if (this.containingType === targetType)
						this._defaultValue = defaultConstant;
					else
						options.default = { function: function () { return defaultConstant; }, dependsOn: "" };
				}
				else {
					throw new Error(`Invalid property 'default' option of type '${getTypeName(options.default)}'.`);
				}

				if (isPropertyOptions<PropertyValueFunctionAndOptions<any>>(options.default)) {
					let defaultOptions = options.default;

					if (typeof (options.default.function) !== "function") {
						throw new Error(`Invalid property 'default' function of type '${getTypeName(options.default.function)}'.`);
					}

					const defaultFn = options.default.function;
					targetType.model.ready(() => {
						new CalculatedPropertyRule(targetType, null, {
							property: this,
							calculate: defaultFn,
							onChangeOf: resolveDependsOn(this, "default", defaultOptions.dependsOn),
							isDefaultValue: true
						}).register();
					});
				}
			}

			// Allowed Values
			if (options.allowedValues) {
				if (typeof (options.allowedValues) === "function") {
					let originalAllowedValues = options.allowedValues;
					let allowedValuesFunction = function (this: Entity): any[] { return originalAllowedValues.call(this); };
					options.get = { function: allowedValuesFunction, dependsOn: "" };
				}

				if (isPropertyOptions<PropertyValueFunctionAndOptions<any[]>>(options.allowedValues)) {
					let allowedValuesOptions = options.allowedValues;

					if (typeof (options.allowedValues.function) !== "function") {
						throw new Error(`Invalid property 'allowedValues' function of type '${getTypeName(options.allowedValues.function)}'.`);
					}

					targetType.model.ready(() => {
						(new AllowedValuesRule(targetType, {
							property: this,
							source: allowedValuesOptions.function,
							ignoreValidation: allowedValuesOptions.ignoreValidation,
							preventInvalidValues: allowedValuesOptions.preventInvalidValues,
							onChangeOf: resolveDependsOn(this, "allowedValues", allowedValuesOptions.dependsOn)
						})).register();
					});
				}
				else {
					throw new Error(`Invalid property 'get' option of type '${getTypeName(options.get)}'.`);
				}
			}

			// Range
			if (options.range) {
				let min: (this: Entity) => any;

				if (options.range.min != null) {
					if (isPropertyValueFunction<any>(options.range.min)) {
						min = options.range.min;
					}
					else if (isValue(options.range.min)) {
						const minConstant = options.range.min;
						min = function() { return minConstant; };
					}
					else {
						throw new Error(`Invalid property 'range.min' option of type '${getTypeName(options.range.min)}'.`);
					}
				}

				let max: (this: Entity) => any;

				if (options.range.max != null) {
					if (isPropertyValueFunction<any>(options.range.max)) {
						max = options.range.max;
					}
					else if (isValue(options.range.max)) {
						const maxConstant = options.range.max;
						max = function() { return maxConstant; };
					}
					else {
						throw new Error(`Invalid property 'range.max' option of type '${getTypeName(options.range.max)}'.`);
					}
				}

				targetType.model.ready(() => {
					let onChangeOf: PropertyPath[] = resolveDependsOn(this, "range", options.range.dependsOn);
					new RangeRule(targetType, { property: this, onChangeOf, min, max }).register();
				});
			}

			// Length
			if (options.length) {
				let min: (this: Entity) => number;

				if (options.length.min != null) {
					if (isPropertyValueFunction<any>(options.length.min)) {
						min = options.length.min;
					}
					else if (isValue<number>(options.length.min, Number)) {
						const minConstant = options.length.min;
						min = function() { return minConstant; };
					}
					else {
						throw new Error(`Invalid property 'length.min' option of type '${getTypeName(options.length.min)}'.`);
					}
				}

				let max: (this: Entity) => number;

				if (options.length.max != null) {
					if (isPropertyValueFunction<any>(options.length.max)) {
						max = options.length.max;
					}
					else if (isValue<number>(options.length.max, Number)) {
						const maxConstant = options.length.max;
						max = function() { return maxConstant; };
					}
					else {
						throw new Error(`Invalid property 'length.max' option of type '${getTypeName(options.length.max)}'.`);
					}
				}

				targetType.model.ready(() => {
					let onChangeOf: PropertyPath[] = resolveDependsOn(this, "length", options.length.dependsOn);
					if (isEntityType(this.propertyType)) {
						new ListLengthRule(targetType, { property: this, onChangeOf, min, max }).register();
					}
					else {
						new StringLengthRule(targetType, { property: this, onChangeOf, min, max }).register();
					}
				});
			}

			// Required
			if (options.required) {
				let requiredOptions = options.required;

				// Store required options on property so that they can be referenced externally
				this.required = requiredOptions;

				// Always Required
				if (typeof (options.required) === "boolean") {
					if (options.required) {
						targetType.model.ready(() => {
							let requiredRule = new RequiredRule(targetType, { property: this });
							requiredRule.register();
						});
					}
				}

				// Conditionally Required
				else {
					let requiredFn: (this: Entity) => boolean;
					let requiredMessage: string | ((this: Entity) => string);
					let requiredDependsOn: string;
					if (isPropertyOptions<PropertyBooleanFunctionAndOptions>(options.required)) {
						requiredFn = options.required.function;
						requiredMessage = options.required.message;
						requiredDependsOn = options.required.dependsOn;
					}
					else {
						requiredFn = options.required;
					}
					targetType.model.ready(() => {
						(new RequiredRule(targetType, {
							property: this,
							when: requiredFn,
							message: requiredMessage,
							onChangeOf: requiredDependsOn ? resolveDependsOn(this, "required", requiredDependsOn) : null
						})).register();
					});
				}
			}

			// Error
			if (options.error) {
				(Array.isArray(options.error) ? options.error : [options.error]).forEach(errorOptions => {
					let errorFn = errorOptions.function;
					if (errorOptions.resource)
						errorFn = function() {
							return errorOptions.function.call(this) ? targetType.model.getResource(errorOptions.resource) : null;
						};
					let errorDependsOn = errorOptions.dependsOn;

					if (typeof (errorFn) !== "function") {
						throw new Error(`Invalid property 'error' function of type '${getTypeName(errorOptions.function)}'.`);
					}

					let conditionType: ConditionType;
					if (errorOptions.code)
						conditionType = ConditionType.get(errorOptions.code) || new ErrorConditionType(errorOptions.code, "error");

					targetType.model.ready(() => {
						(new ValidationRule(targetType, {
							property: this,
							properties: errorOptions.properties ? flatMap(errorOptions.properties, p => targetType.getPaths(p)) : null,
							onChangeOf: resolveDependsOn(this, "", errorDependsOn),
							message: errorFn,
							conditionType: conditionType
						})).register();
					});
				});
			}
		});
	}

	equals(prop: PropertyPath): boolean {
		if (prop === null || prop === undefined) {
			return;
		}

		if (prop instanceof PropertyChain) {
			return (prop as PropertyChain).equals(this);
		}

		if (prop instanceof Property) {
			return this === prop;
		}
	}

	each(obj: Entity, callback: (obj: any, property: Property) => any, filter: Property = null): void {
		if (!filter || filter === this)
			callback(obj, this);
	}

	toString(): string {
		return `this<${this.containingType}>.${this.name}`;
	}

	canSetValue(obj: Entity, val: any): boolean {
		// NOTE: only allow values of the correct data type to be set in the model

		if (val === undefined) {
			// TODO: Warn about setting value to undefined?
			// logWarning("You should not set property values to undefined, use null instead: property = ." + this._name + ".");
			// console.warn(`You should not set property values to undefined, use null instead: property = ${this.name}.`);
			return true;
		}

		if (val === null) {
			return true;
		}

		// for entities check base types as well
		if (val.constructor && val.constructor.meta) {
			for (var valType: Type = val.constructor.meta; valType; valType = valType.baseType) {
				if (valType.jstype === this.propertyType) {
					return true;
				}
			}

			return false;
		}

		// Data types
		else {
			var valObjectType = val.constructor;

			// "Normalize" data type in case it came from another frame as well as ensure that the types are the same
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
			return valObjectType === this.propertyType ||

				// entity array type check
				(valObjectType === Array && this.isList && (!this.propertyType || val.every(function (this: Property, child: any) {
					if (isEntityType(this.propertyType)) {
						if (child.constructor && child.constructor.meta) {
							for (let childType: Type = child.constructor.meta; childType; childType = childType.baseType) {
								if (childType.jstype === this.propertyType) {
									return true;
								}
							}
						}

						return false;
					}
					else {
						var itemObjectType = child.constructor;

						// "Normalize" data type in case it came from another frame as well as ensure that the types are the same
						switch (getTypeName(child)) {
							case "string":
								itemObjectType = String;
								break;
							case "number":
								itemObjectType = Number;
								break;
							case "boolean":
								itemObjectType = Boolean;
								break;
							case "date":
								itemObjectType = Date;
								break;
							case "array":
								itemObjectType = Array;
								break;
						}

						return itemObjectType === this.propertyType;
					}
				}, this)));
		}
	}

	value(obj: Entity = null, val: any = null, additionalArgs: any = null): any {
		if (obj === undefined || obj === null) {
			throw new Error(`Cannot ${(arguments.length > 1 ? "set" : "get")} value for property "${this.name}" on type "${this.containingType}": target is null or undefined.`);
		}

		if (arguments.length > 1) {
			Property$setter(this, obj, val, additionalArgs);
		}
		else {
			return Property$getter(this, obj);
		}
	}

	isInited(obj: Entity): boolean {
		// If the backing field has been created, the property is initialized
		return obj.__fields__.hasOwnProperty(this.name);
	}
}

export interface PropertyOptions {

	/** The name or Javascript type of the property */
	type?: string | PropertyType;

	/**
	*  The optional label for the property.
	*  The property name will be used as the label when not specified.
	*/
	label?: string;

	/**
	 * The optional path to use for the source of the property's label, if it contains format tokens
	 */
	labelSource?: string;

	/** The optional helptext for the property */
	helptext?: string;

	/** The optional format specifier for the property. */
	format?: string | Format<PropertyType> | PropertyFormatOptions;

	/** A non-null value if the property is constant */
	constant?: any;

	/** An optional function or dependency function object that calculates the value of this property. */
	get?: PropertyValueFunction<any> | PropertyValueFunctionAndOptions<any>;

	/** An optional function to call when this property is updated. */
	set?: (this: Entity, value: any) => void;

	/** An optional constant default value, or a function or dependency function object that calculates the default value of this property. */
	default?: PropertyValueFunction<any> | PropertyValueFunctionAndOptions<any> | Value | Value[];

	init?: PropertyValueFunction<any> | Value | Value[];

	/** An optional constant default value, or a function or dependency function object that calculates the default value of this property. */
	allowedValues?: PropertyValueFunction<any[]> | AllowedValuesFunctionAndOptions<any[]> | Value[];

	/** True if the property is always required, or a dependency function object for conditionally required properties. */
	required?: boolean | PropertyBooleanFunction | PropertyBooleanFunctionAndOptions;

	/** An optional dependency function object that adds an error with the specified message when true. */
	error?: PropertyErrorFunctionAndOptions | PropertyErrorFunctionAndOptions[];

	/** Optional contant or function-based min and max values. */
	range?: PropertyRangeOptions<any>;

	/** Optional contant or function-based min and max length. */
	length?: PropertyLengthOptions;
}

export interface PropertyFormatOptions {

	/** The human readable description of the format, such as MM/DD/YYY */
	description: string;

	/** A regular expression that the property value must match */
	expression: RegExp;

	/** An optional regular expression reformat string that will be used to correct the value if it matches */
	reformat?: string;

	message?: string | ((this: Entity) => string);
}

export interface PropertyErrorFunctionAndOptions {
	function: (this: Entity) => string;
	dependsOn: string;
	resource?: string;
	code?: string;
	properties?: string[];
}

export type PropertyValueFunction<T> = () => T;

export interface PropertyValueFunctionAndOptions<T> {
	function: (this: Entity) => T;
	dependsOn?: string;
}

export function isPropertyValueFunction<T>(obj: any): obj is PropertyValueFunction<T> {
	return typeof (obj) === "function";
}

export interface AllowedValuesFunctionAndOptions<T> extends PropertyValueFunctionAndOptions<T> {
	ignoreValidation?: boolean;
	preventInvalidValues?: boolean;
}

type LambdaFunction<ReturnType> = () => ReturnType;

type BoundFunction<ThisType, ReturnType> = (this: ThisType) => ReturnType;

export interface PropertyRangeOptions<T> {
	min?: T | LambdaFunction<T> | BoundFunction<Entity, T>;
	max?: T | LambdaFunction<T> | BoundFunction<Entity, T>;
	dependsOn?: string;
}

export interface PropertyLengthOptions {
	min?: number | LambdaFunction<number> | BoundFunction<Entity, number>;
	max?: number | LambdaFunction<number> | BoundFunction<Entity, number>;
	dependsOn?: string;
}

export type PropertyBooleanFunction = (this: Entity) => boolean;

export interface PropertyBooleanFunctionAndOptions {
	function?: (this: Entity) => boolean;
	dependsOn?: string;
	message?: string | ((this: Entity) => string);
}

export function isPropertyBooleanFunctionAndOptions(obj: any): obj is PropertyBooleanFunctionAndOptions {
	return typeof (obj) === "object";
}

export function isPropertyBooleanFunction(obj: any): obj is PropertyBooleanFunction {
	return typeof (obj) === "function";
}

export function isPropertyOptions<TOptions>(obj: any, check: (options: any) => boolean = null): obj is TOptions {
	return isType<TOptions>(obj, d => getTypeName(d) === "object" && (!check || check(d)));
}

export interface PropertyConstructor {
	new(containingType: Type, name: string, jstype: PropertyType, isList: boolean, options?: PropertyOptions): Property;
}

export type PropertyGetMethod = (property: Property, entity: Entity, additionalArgs: any) => any;

export type PropertySetMethod = (property: Property, entity: Entity, val: any, additionalArgs: any, skipTypeCheck: boolean) => void;

export interface PropertyRule extends Rule {

	/** The property that the rule targets */
	readonly property: Property;

}

export interface PropertyRuleOptions extends RuleOptions {

	// the property being validated
	property: Property;

}

/**
 * Gets a format object for the given property's label, if it is dynamic (i.e. contains format tokens)
 */
export function getLabelFormat(property: PropertyPath): Format<Entity> | undefined {
	if (property.label && property.labelIsFormat) {
		const labelSourceType = getLabelSourceType(property);
		return labelSourceType.model.getFormat<Entity>(labelSourceType.jstype, property.label);
	}
}

/**
 * Gets the model type of the source object that should be used to evaluate the
 * property's label, if it is dynamic (i.e. contains format tokens)
 */
export function getLabelSourceType(property: PropertyPath): Type {
	// If a label source is specified, then determine it's model type
	if (property.labelSource) {
		const labelSourceType = property.labelSource.propertyType;
		if (isEntityType(labelSourceType))
			return labelSourceType.meta;
	}

	return property.containingType;
}

/**
 * Evaluates the given property's label, using the given entity as context if the label is dynamic (i.e. contains format tokens)
 */
export function evaluateLabel(property: PropertyPath, entity: Entity): string {
	if (property.labelIsFormat) {
		const labelFormat = getLabelFormat(property);
		let labelFormatInstance = entity;
		if (property.labelSource) {
			labelFormatInstance = property.labelSource.value(entity);
		}
		return labelFormat.convert(labelFormatInstance);
	}
	else {
		return property.label;
	}
}

export function Property$format(prop: Property, val: any): string {
	if (prop.format) {
		return prop.format.convert(val);
	}
}

// export function Property$equals(prop1: Property | IPropertyChain, prop2: Property | IPropertyChain): boolean {

// 	if (prop1 === null || prop1 === undefined || prop2 === null || prop2 === undefined) {
// 		return;
// 	}

// 	if (PropertyChain$isPropertyChain(prop1)) {
// 		return (prop1 as PropertyChain).equals(prop2);
// 	}

// 	if (PropertyChain$isPropertyChain(prop2)) {
// 		return (prop2 as PropertyChain).equals(prop1);
// 	}

// 	if (Property$isProperty(prop1) && Property$isProperty(prop2)) {
// 		return prop1 === prop2;
// 	}

// }

export function Property$generateShortcuts(property: Property, target: any, overwrite: boolean = null): void {
	var shortcutName = "$" + property.name;

	if (!(Object.prototype.hasOwnProperty.call(target, shortcutName)) || overwrite) {
		target[shortcutName] = property;
	}
}

export function Property$generateStaticProperty(property: Property, target: any): void {
	Object.defineProperty(target, property.name, {
		configurable: false,
		enumerable: true,
		get: property.getter,
		set: property.setter
	});
}

export function Property$generatePrototypeProperty(property: Property, target: any): void {
	Object.defineProperty(target, property.name, {
		configurable: false,
		enumerable: true,
		get: property.getter,
		set: property.setter
	});
}

export function Property$generateOwnProperty(property: Property, obj: Entity): void {
	Object.defineProperty(obj, property.name, {
		configurable: false,
		enumerable: true,
		get: property.getter,
		set: property.setter
	});
}

export function Property$pendingInit(obj: Entity, prop: Property, value: boolean = null): boolean | void {
	let pendingInit: ObjectLookup<boolean>;

	if (Object.prototype.hasOwnProperty.call(obj, "__pendingInit__")) {
		pendingInit = (obj as any).__pendingInit__;
	}
	else {
		Object.defineProperty(obj, "__pendingInit__", { enumerable: false, value: (pendingInit = {}), writable: true });
	}

	if (arguments.length > 2) {
		if (value === false) {
			delete pendingInit[prop.name];
		}
		else {
			pendingInit[prop.name] = value;
		}
	}
	else {
		let currentValue = obj.__fields__[prop.name];
		return currentValue === undefined || pendingInit[prop.name] === true;
	}
}

function Property$subArrayEvents(obj: Entity, property: Property, array: ObservableArray<any>): void {
	array.changed.subscribe(function (args) {
		// NOTE: property change should be broadcast before rules are run so that if
		// any rule causes a roundtrip to the server these changes will be available
		// TODO: Implement notifyListChanged?
		// property.containingType.model.notifyListChanged(target, property, changes);
		if (!args.changes.length)
			return;

		// NOTE: oldValue is not currently implemented for lists
		var eventArgs: PropertyChangeEventArgs = { entity: obj, property, newValue: array };

		(eventArgs as any)["changes"] = args.changes;
		(eventArgs as any)["collectionChanged"] = true;

		(property.containingType.model.listChanged as Event<Entity, EntityChangeEventArgs>).publish(obj, { entity: obj, property, newValue: array });
		(property.changed as EventPublisher<Entity, PropertyChangeEventArgs>).publish(obj, eventArgs);
		(obj.changed as Event<Entity, EntityChangeEventArgs>).publish(obj, { entity: obj, property, newValue: array });
	});
}

function Property$getInitialValue(property: Property, obj: Entity): any {
	// Constant
	if (property.isConstant)
		return typeof property.constant === "function" ? (property.constant = property.constant()) : property.constant;

	var val = property.initializer
		? property.initializer.call(obj)
		: property.defaultValue;

	if (Array.isArray(val)) {
		val = ObservableArray.ensureObservable(val as any[]);

		// Override the default toString on arrays so that we get a comma-delimited list
		// TODO: Implement toString on observable list?
		// val.toString = Property$_arrayToString.bind(val);
	}

	return val;
}

export function Property$init(property: Property, obj: Entity, val: any): void {
	Property$pendingInit(obj, property, false);

	Object.defineProperty(obj.__fields__, property.name, { value: val, writable: true });

	if (Array.isArray(val)) {
		Property$subArrayEvents(obj, property, ObservableArray.ensureObservable(val));
	}

	// TODO: Implement observable?
	(obj.changed as Event<Entity, EntityChangeEventArgs>).publish(obj, { entity: obj, property, newValue: val });
}

function Property$ensureInited(property: Property, obj: Entity): void {
	// Determine if the property has been initialized with a value and initialize the property if necessary
	if (!obj.__fields__.hasOwnProperty(property.name)) {
		Property$pendingInit(obj, property, true);

		// Do not initialize calculated properties. Calculated properties should be initialized using a property get rule.
		if (!property.isCalculated) {
			Property$init(property, obj, Property$getInitialValue(property, obj));

			const underlyingValue = obj.__fields__[property.name];
			// Mark the property as pending initialization if it still has no underlying value, or is the property type's default, to allow default calculation rules to run for it
			// List properties are defaulted onInitNew instead of on access
			if (underlyingValue === property.defaultValue && !Array.isArray(underlyingValue))
				Property$pendingInit(obj, property, true);
		}
	}
}

function Property$getter(property: Property, obj: Entity): any {
	// Ensure that the property has an initial (possibly default) value
	Property$ensureInited(property, obj);

	// Raise access events
	(property.accessed as EventPublisher<Entity, PropertyAccessEventArgs>).publish(obj, { entity: obj, property, value: obj.__fields__[property.name] });
	(obj.accessed as Event<Entity, EntityAccessEventArgs>).publish(obj, { entity: obj, property });

	// Return the property value
	return obj.__fields__[property.name];
}

export function Property$setter(property: Property, obj: Entity, val: any, additionalArgs: any = null): void {
	// Ensure that the property has an initial (possibly default) value
	Property$ensureInited(property, obj);

	var old = obj.__fields__[property.name];

	if (Property$shouldSetValue(property, obj, old, val)) {
		Property$setValue(property, obj, old, val, additionalArgs);
	}
}

function Property$shouldSetValue(property: Property, obj: Entity, old: any, val: any): boolean {
	if (!property.canSetValue(obj, val)) {
		throw new Error("Cannot set " + property.name + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.fullName + "|" + obj.meta.id + ": a value of type " + (isEntityType(property.propertyType) ? property.propertyType.meta.fullName : parseFunctionName(property.propertyType)) + " was expected.");
	}

	for (const rule of property.rules) {
		if (rule instanceof AllowedValuesRule && rule.preventInvalidValues && !rule.values(obj).includes(val) && val !== null && val !== undefined) {
			throw new Error("Cannot set "+ property.name + ", \""+ val +"\" is not an allowed value.");
		}
	}

	// Update lists as batch remove/add operations
	if (property.isConstant) {
		throw new Error("Constant properties cannot be modified.");
	}
	else if (property.isList) {
		throw new Error("Property set on lists is not permitted.");
	}
	else {
		// compare values so that this check is accurate for primitives
		var oldValue = (old === undefined || old === null) ? old : old.valueOf();
		var newValue = (val === undefined || val === null) ? val : val.valueOf();

		// Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
		// not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
		// get this far for Number properties unless the value is actually of type Number (a number or NaN).
		return (oldValue !== newValue && !(property.propertyType === Number && isNaN(oldValue) && isNaN(newValue)));
	}
}

function Property$setValue(property: Property, obj: Entity, currentValue: any, newValue: any, additionalArgs: any = null): void {
	// Update lists as batch remove/add operations
	if (property.isList) {
		let currentArray = currentValue as ObservableArray<any>;
		currentArray.batchUpdate((array) => {
			updateArray(array, newValue);
		});
	}
	else {
		let oldValue = currentValue;

		// Set or create the backing field value
		if (Object.prototype.hasOwnProperty.call(obj.__fields__, property.name)) {
			obj.__fields__[property.name] = newValue;
		}
		else {
			Object.defineProperty(obj.__fields__, property.name, { value: newValue, writable: true });
		}

		if (property.isIdentifier && newValue && newValue !== obj.meta.id) {
			// If the identifier property is set or changed, then change the object's id and re-pool with the new id
			obj.meta.type.changeObjectId(obj.meta.id, newValue);
		}

		Property$pendingInit(obj, property, false);

		// Do not raise change if the property has not been initialized.
		if (oldValue !== undefined) {
			var eventArgs: PropertyChangeEventArgs = { entity: obj, property, newValue, oldValue };
			(property.containingType.model.afterPropertySet as Event<Entity, EntityChangeEventArgs>).publish(obj, { entity: obj, property, newValue, oldValue });
			(property.changed as EventPublisher<Entity, PropertyChangeEventArgs>).publish(obj, additionalArgs ? merge(eventArgs, additionalArgs) : eventArgs);
			(obj.changed as Event<Entity, EntityChangeEventArgs>).publish(obj, { entity: obj, property, oldValue, newValue });
		}
	}
}

function Property$makeGetter(property: Property, getter: PropertyGetMethod): (args?: any) => any {
	return function (additionalArgs: any = null) {
		// ensure the property is initialized
		return getter(property, this, additionalArgs);
	};
}

function Property$makeSetter(prop: Property, setter: PropertySetMethod, skipTypeCheck: boolean = false): (value: any, args?: any) => void {
	// TODO: Is setter "__notifies" needed?
	// setter.__notifies = true;

	return function (val: any, additionalArgs: any = null) {
		setter(prop, this, val, additionalArgs, skipTypeCheck);
	};
}
