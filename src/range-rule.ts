import { ValidationRule, ValidationRuleOptions } from "./validation-rule";
import { Property$format } from "./property";
import { Entity } from "./entity";
import { Type } from "./type";
import { normalize } from "./model";

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
			var val = normalize(options.property.value(this), format);

			if (val == null) {
				return null;
			}	
			
			var range: { min?: any; max?: any } = {};
				
			if (options.min && options.min instanceof Function) {
				try {
					range.min = normalize(options.min.call(this), format);					
				}
				catch (e) {
					// Silently ignore min errors
				}
			}
	
			if (options.max && options.max instanceof Function) {
				try {
					range.max = normalize(options.max.call(this), format);
				}
				catch (e) {
					// Silently ignore max errors
				}
			}

			if ((range.min == null || val >= range.min) && (range.max == null || val <= range.max)) {				
				// Value is within range
				return null;
			}

			const hasMin = range.min || range.min === 0;
			const hasMax = range.max || range.max === 0;

			if (hasMin && hasMax)
				return rootType.model.getResource("range-between").replace("{min}", Property$format(options.property, range.min) || range.min).replace("{max}", Property$format(options.property, range.max) || range.max);

			if (options.property.propertyType === Date) {
				if (hasMin)
					return rootType.model.getResource("range-on-or-after").replace("{min}", Property$format(options.property, range.min) || range.min);
				else
					return rootType.model.getResource("range-on-or-before").replace("{max}", Property$format(options.property, range.max) || range.max);
			}

			if (hasMin)
				return rootType.model.getResource("range-at-least").replace("{min}", Property$format(options.property, range.min) || range.min);
			else
				return rootType.model.getResource("range-at-most").replace("{max}", Property$format(options.property, range.max) || range.max);
		};

		// call the base type constructor
		super(rootType, options);
	}

	// get the string representation of the rule
	toString(): string {
		return `${this.property.containingType.fullName}.${this.property.name} in range, min: , max: `;
	}
}

export interface RangeRuleOptions extends ValidationRuleOptions {
	min?: (this: Entity) => any;
	max?: (this: Entity) => any;
}
