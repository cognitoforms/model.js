import { Entity } from "../src/entity";
import { IgnoreProperty, PropertyConverter, PropertySerializationResult } from "../src/entity-serializer";
import { Property } from "../src/property";

export class IgnorePropertyConverter extends PropertyConverter {
	readonly propertyName: string;
	constructor(propertyName: string) {
		super();
		this.propertyName = propertyName;
	}
	shouldConvert(context: Entity, prop: Property): boolean {
		if (prop.name === this.propertyName)
			return true;
		return false;
	}
	serialize(): PropertySerializationResult {
		return IgnoreProperty;
	}
}
