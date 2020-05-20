import { ValidationRule, ValidationRuleOptions } from "./validation-rule";
import { Property$format } from "./property";
import { Entity } from "./entity";
import { Type } from "./type";
import { Format } from "./format";

/**
 * A rule that validates that a property value is within a specific range
 */
export class RangeRule extends ValidationRule {
	/**
	 * Creates a rule that validates a property value is within a specific range
	 * @param rootType The model type the rule is for
	 * @param options The options for the rule
	 */
	constructor(rootType: Type, options: RangeRuleOptions) {
		// ensure the rule name is specified
		options.name = options.name || "Range";

		options.message = function(this: Entity): string {			
			let format = options.property.format;		
			var val = RangeRule.standardize(options.property.value(this), format);

			if (val == null) {
				return null;
			}	
			
			const range = RangeRule.getRange(this, options);

			if ((range.min == null || val >= range.min) && (range.max == null || val <= range.max)) {				
				// Value is within range
				return null;
			}

			if (range.min !== undefined && range.max !== undefined)
				return rootType.model.getResource("range-between").replace("{min}", Property$format(options.property, range.min) || range.min).replace("{max}", Property$format(options.property, range.max) || range.max);

			if (options.property.propertyType === Date) {
				if (range.min != null)
					return rootType.model.getResource("range-on-or-after").replace("{min}", Property$format(options.property, range.min) || range.min);
				else
					return rootType.model.getResource("range-on-or-before").replace("{max}", Property$format(options.property, range.max) || range.max);
			}

			if (range.min != null)
				return rootType.model.getResource("range-at-least").replace("{min}", Property$format(options.property, range.min) || range.min);
			else
				return rootType.model.getResource("range-at-most").replace("{max}", Property$format(options.property, range.max) || range.max);
		};
		
		options.preExecute = (entity) => {			
			this["range"] = RangeRule.getRange(entity, options);
		}

		// call the base type constructor
		super(rootType, options);

		Object.defineProperty(this, "range", { value: null, writable: true });
	}

	// get the string representation of the rule
	toString(): string {
		return `${this.property.containingType.fullName}.${this.property.name} in range, min: , max: `;
	}

	private static getRange(entity: Entity, options: RangeRuleOptions) : Range
	{
		let format = options.property.format;		
		let range: Range = { };
				
		if (options.min && options.min instanceof Function) {
			try {
				range["min"] = RangeRule.standardize(options.min.call(entity), format);					
			}
			catch (e) {
				// Silently ignore min errors
			}
		}

		if (options.max && options.max instanceof Function) {
			try {
				range["max"] = RangeRule.standardize(options.max.call(entity), format);
			}
			catch (e) {
				// Silently ignore max errors
			}
		}

		return range;
	}

	// January 1st, 1970 at 12AM
	private static JAN_01_1970 = new Date(18000000);

	// Standardize the provided value based on the format specifier
	// so that it can be used appropriately for comparisons
	private static standardize(val: any, format: Format<any>) : any {
		if (!val && val !== false)
			return val;

		if (val.constructor.name === "Date") {
			if (format.specifier === "t")
				val = RangeRule.standardizeDate(val);
			else if (format.specifier === "d")
				val = RangeRule.standardizeTime(val);
		}

		return val;
	}
	
	// Set the date of the dateTime to January 1st, 1970
	private static standardizeDate(dateTime: Date): Date {
		return RangeRule._standardizeDate(dateTime, RangeRule.JAN_01_1970);
	}

	// Set the date of the dateTime to the supplied standardized date
	private static _standardizeDate(dateTime: Date, standard: Date): Date {
		let _dateTime = new Date(dateTime);
		_dateTime.setMonth(standard.getMonth());
		_dateTime.setDate(standard.getDate());
		_dateTime.setFullYear(standard.getFullYear());
		return _dateTime ;
	}

	// Set the time of the dateTime to 12AM	
	private static standardizeTime(dateTime: Date): Date {
		return RangeRule._standardizeDate(RangeRule.JAN_01_1970, dateTime);
	}
}

export interface RangeRuleOptions extends ValidationRuleOptions {
	min?: (this: Entity) => any;
	max?: (this: Entity) => any;
}

interface Range
{
	min?: any;
	max?: any;
}