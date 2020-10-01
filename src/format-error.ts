import { ErrorConditionType } from "./condition-type";
import { Entity } from "./entity";
import { Property } from "./property";
import { Condition } from "./condition";
import { Format } from "./format";

export class FormatError {
	readonly messageTemplate: string;
	readonly invalidValue: any;
	readonly format: Format<any>;

	static ConditionType: ErrorConditionType = null;

	constructor(format: Format<any>, message: string, invalidValue: any) {
		if (FormatError.ConditionType === null) {
			FormatError.ConditionType = new ErrorConditionType("FormatError", "The value is not properly formatted.");
		}

		this.format = format;
		this.messageTemplate = message;
		this.invalidValue = invalidValue;
	}

	createCondition(target: Entity, prop: Property): Condition {
		return new Condition(FormatError.ConditionType, this.messageTemplate.replace("{property}", prop.label), target, this.format, [prop]);
	}

	toString(): string {
		return this.invalidValue;
	}
}
