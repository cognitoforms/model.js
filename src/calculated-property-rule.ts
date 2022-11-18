import { Rule, RuleInvocationOptions, RuleOptions } from "./rule";
import { Type } from "./type";
import { Property, Property$init, Property$pendingInit, PropertyRuleOptions } from "./property";
import { Entity } from "./entity";
import { ObservableArray, updateArray } from "./observable-array";
import { RuleInvocationType } from "./rule-invocation-type";

let calculationErrorDefault: any = null;

export class CalculatedPropertyRule extends Rule {
	// Public read-only properties: aspects of the object that cannot be
	// changed without fundamentally changing what the object is
	readonly property: Property;

	// Public settable properties that are simple values with no side-effects or logic
	defaultIfError: any;
	private isDefaultValue: boolean;

	// Backing fields for properties that are settable and also derived from
	// other data, calculated in some way, or cannot simply be changed
	private _calculateFn: string | ((this: Entity) => any);

	constructor(rootType: Type, name: string, options: CalculatedPropertyRuleOptions) {
		let property: Property;
		let defaultIfError: any = calculationErrorDefault;
		let calculateFn: string | ((this: Entity) => any);

		if (!name) {
			name = options.name;
		}

		if (options) {
			if (options.property) {
				property = typeof options.property === "string" ? rootType.getProperty(options.property) as Property : options.property as Property;

				if (options.isDefaultValue && property.isList)
					(options as RuleInvocationOptions).onInitNew = true;

				// indicate that the rule is responsible for returning the value of the calculated property
				options.returns = [property];
			}

			if (!name) {
				// Generate a reasonable default rule name if not specified
				name = options.name = (rootType.fullName + "." + (typeof property === "string" ? property : property.name) + ".Calculated");
			}

			if (options.hasOwnProperty("defaultIfError"))
				defaultIfError = options.defaultIfError;

			calculateFn = options.calculate;
		}

		// Call the base rule constructor
		super(rootType, name, options);

		// Public read-only properties
		Object.defineProperty(this, "property", { enumerable: true, value: property });

		// Public settable properties
		this.defaultIfError = defaultIfError;

		this.isDefaultValue = !!options.isDefaultValue;

		// Backing fields for properties
		if (calculateFn) Object.defineProperty(this, "_calculateFn", { enumerable: false, value: calculateFn, writable: true });

		// register the rule with the target property
		this.property.rules.push(this);

		// mark the property as calculated if the rule runs on property access and is not a default value calculation
		if (!options.isDefaultValue && this.invocationTypes & RuleInvocationType.PropertyGet)
			this.property.isCalculated = true;
	}

	register() {
		super.register();

		if (this.isDefaultValue) {
			// Ensure that a default value rule will run if a calculation that it depends on is changed.
			// A property with a default value rule may have a persisted value, in which case it will
			// not run unless one of its predicates fires a change event. A calculation will not fire
			// a change event the first time it runs if it didn't previously have a value, which may
			// be the case for existing instances if the calculation is never accessed (ex: a hidden field).
			// So, in order to ensure that the default rule's calculated predicates fire a change event,
			// we must ensure that the calculation is accessed when the object is initialized.
			this.rootType.initExisting.subscribe((args) => {
				// If the property is initialized (i.e. it has an initial persisted value),
				// run the calculation and throw away the result.
				const initialValue = args.entity.__fields__[this.property.name];
				if (initialValue !== undefined) {
					try {
						this.calculateFn.call(args.entity);
					}
					catch (e) {
					}
				}
			});
		}
	}

	get calculateFn() {
		let calculateFn: (this: Entity) => any;

		// Convert string functions into compiled functions on first execution
		if (this._calculateFn.constructor === String) {
			// TODO: Calculation expression support
			let calculateExpr = this._calculateFn as string;
			let calculateCompiledFn = new Function("return " + calculateExpr + ";");
			calculateFn = this._calculateFn = calculateCompiledFn as (this: Entity) => any;
		}
		else {
			calculateFn = this._calculateFn as (this: Entity) => any;
		}

		return calculateFn;
	}

	execute(obj: Entity): void {
		// Calculate the new property value
		var newValue;
		if (this.defaultIfError === undefined) {
			newValue = this.calculateFn.call(obj);
		}
		else {
			try {
				newValue = this.calculateFn.call(obj);
			}
			catch (e) {
				newValue = this.defaultIfError;
			}
		}

		// Exit immediately if the calculated result was undefined
		if (newValue === undefined) {
			return;
		}

		// modify list properties to match the calculated value instead of overwriting the property
		if (this.property.isList) {
			const newList = newValue;

			// ensure the initial calculation of the list does not raise change events
			// defaulting a list property should raise change events
			if (!this.isDefaultValue && Property$pendingInit(obj, this.property))
				Property$init(this.property, obj, newList);
			else {
				// compare the new list to the old one to see if changes were made
				const curList = this.property.value(obj) as ObservableArray<any>;

				if (newList.length === curList.length) {
					var noChanges = true;

					for (var i = 0; i < newList.length; ++i) {
						if (newList[i] !== curList[i]) {
							noChanges = false;
							break;
						}
					}

					if (noChanges) {
						return;
					}
				}

				// update the current list so observers will receive the change events
				// events will not be raised if this is the initial calculation of the list
				curList.batchUpdate((array) => {
					updateArray(array, newList);
				});
			}
		}
		else {
			// Otherwise, just set the property to the new value
			this.property.value(obj, newValue, { calculated: true });
		}
	}

	toString(): string {
		return "calculation of " + this.property.name;
	}
}

export interface CalculatedPropertyRuleOptions extends RuleOptions, PropertyRuleOptions {
	/** A function that returns the value to assign to the property, or undefined if the value cannot be calculated */
	calculate?: string | ((this: Entity) => any);

	/** A function that returns the value to assign to the property, or undefined if the value cannot be calculated */
	fn?: (this: Entity) => any;

	/** The value to return if an error occurs, or undefined to cause an exception to be thrown */
	defaultIfError?: any;

	/** Specifies whether or not the rule is to calculate a property's default value */
	isDefaultValue?: boolean;
}

export interface CalculatedPropertyRuleConstructor {
	/**
	 * Creates a rule that calculates the value of a property in the model
	 * @param rootType The model type the rule is for
	 * @param name The name of the rule
	 * @param options The options of the rule of type 'CalculatedPropertyRuleOptions'
	 */
	new(rootType: Type, name: string, options: CalculatedPropertyRuleOptions): Rule;
}
