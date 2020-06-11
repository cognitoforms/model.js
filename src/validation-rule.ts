import { ConditionRule, ConditionRuleOptions } from "./condition-rule";
import { PropertyRule, Property, PropertyRuleOptions } from "./property";
import { Entity } from "./entity";
import { Type, isEntityType } from "./type";

export class ValidationRule extends ConditionRule implements PropertyRule {
	property: Property;

	constructor(rootType: Type, options: ValidationRuleOptions) {
		// ensure the rule name is specified
		options.name = options.name || "ValidatedProperty";

		// store the property being validated
		const property = options.property;

		// ensure the properties and predicates to include the target property
		if (!options.properties)
			options.properties = [];

		if (!options.properties.includes(property))
			options.properties.push(property);

		if (!options.onChangeOf) {
			options.onChangeOf = [property];
		}
		else if (options.onChangeOf.indexOf(property) < 0) {
			options.onChangeOf.push(property);
		}

		// default condition category to Error if a condition category was not specified
		if (!options.conditionType) {
			options.category = "Error";
		}

		// replace the property label token in the validation message if present
		if (options.message && (typeof options.message === "function" || (typeof options.message === "string" && options.message.indexOf("{property}") >= 0))) {
			// Property label with dynamic format tokens
			if (property.labelIsFormat) {
				let labelSourceType = rootType;

				// If a label source is specified, then determine it's model type
				if (property.labelSource) {
					const labelSourcePropertyType = property.labelSource.propertyType;
					if (isEntityType(labelSourcePropertyType))
						labelSourceType = labelSourcePropertyType.meta;
				}

				// convert the property label into a model format
				let labelFormat = rootType.model.getFormat(labelSourceType.jstype, property.label);

				// ensure tokens included in the format trigger rule execution
				labelFormat.paths.forEach(p => {
					labelSourceType.getPaths(p).forEach(prop => {
						let labelTokenProp = prop;
						if (property.labelSource) {
							labelTokenProp = rootType.getPath(property.labelSource.path + "." + prop.path);
						}
						if (!options.onChangeOf) {
							options.onChangeOf = [labelTokenProp];
						}
						else if (options.onChangeOf.indexOf(labelTokenProp) < 0) {
							options.onChangeOf.push(labelTokenProp);
						}
					});
				});

				if (typeof options.message === "function") {
					let messageFunction = options.message;

					// Create a function to apply the format to the property label when generating the message
					options.message = function () {
						let message = "";

						try {
							message = messageFunction.call(this);
							if (typeof message === "string" && message.trim().length > 0 && message.indexOf("{property}") >= 0) {
								let labelFormatInstance = this;
								if (property.labelSource) {
									labelFormatInstance = property.labelSource.value(this);
								}
								message = message.replace("{property}", labelFormat.convert(labelFormatInstance));
							}
						}
						catch (e) {
							console.warn(e);
						}

						return message;
					};
				}
				else if (typeof options.message === "string") {
					let messageTemplate = options.message;

					// Create a function to apply the format to the property label when generating the message
					options.message = function () {
						let labelFormatInstance = this;
						if (property.labelSource) {
							labelFormatInstance = property.labelSource.value(this);
						}
						return messageTemplate.replace("{property}", labelFormat.convert(labelFormatInstance));
					};
				}
			}
			// Static property label
			else if (typeof options.message === "string") {
				options.message = options.message.replace("{property}", property.label);
			}
			// Use static property label in function return value
			else if (typeof options.message === "function") {
				let messageFunction = options.message;

				// Create a function to apply the format to the property label when generating the message
				options.message = function () {
					let message = "";
					try {
						message = messageFunction.call(this);
						if (typeof message === "string" && message.trim().length > 0 && message.indexOf("{property}") >= 0) {
							message = message.replace("{property}", property.label);
						}
					}
					catch (e) {
						console.warn(e);
					}
					return message;
				};
			}
		}

		if (options.isValid) {
			options.assert = function(this: Entity): boolean {
				let isValid;

				try {
					isValid = options.isValid.call(this, options.property as Property, options.property.value(this));
				}
				catch (e) {
					console.warn(e);
				}

				return isValid === undefined ? isValid : !isValid;
			};
		}

		// call the base rule constructor
		super(rootType, options);

		Object.defineProperty(this, "property", { value: property });

		// register the rule with the target property
		this.property.rules.push(this);
	}
}

export interface ValidationRuleOptions extends ConditionRuleOptions, PropertyRuleOptions {

	// function (obj, prop, val) { return true; } (a predicate that returns true when the property is valid)
	isValid?: ((this: Entity, prop: Property, val: any) => boolean);

}

export interface ValidationRuleConstructor {
	new(rootType: Type, options: ValidationRuleOptions): ValidationRule;
}
