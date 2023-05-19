import { Entity } from "../src/entity";
import { PropertyConverter, PropertySerializationResult } from "../src/entity-serializer";
import { Property } from "../src/property";

export class IdReferencePropertyConverter extends PropertyConverter {
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
	serialize(context: Entity, value: Entity): PropertySerializationResult {
		return { key: this.propertyName, value: value ? value.meta.id : null };
	}
}
