import { ErrorConditionType } from "./condition-type";
import { Entity } from "./entity";
import { Property } from "./property";
import { Condition } from "./condition";
import { Format } from "./format";

export class FormatError {	
	readonly messageTemplate: string;
	readonly invalidValue: any;
	source: Format<any>;
	
	static ConditionType: ErrorConditionType = null;

	constructor(source: Format<any>, message: string, invalidValue: any) {
		if (FormatError.ConditionType === null) {
			FormatError.ConditionType = new ErrorConditionType("FormatError", "The value is not properly formatted.");
		}

		this.source = source;
		this.messageTemplate = message;
		this.invalidValue = invalidValue;
	}

	createCondition(target: Entity, prop: Property): Condition {
		// TODO: Format error doesn't handle tokens?
		// pass through "this"
		return new Condition(FormatError.ConditionType, this.messageTemplate.replace("{property}", prop.label), target, this.source, [prop]);
	}

	toString(): string {
		return this.invalidValue;
	}
}
