import { Entity } from "../src/entity";
import { PropertyConverter } from "../src/entity-serializer";
import { Property } from "../src/property";
import { isEntityType } from "../src/type";

export class InitializeBackReferencesConverter extends PropertyConverter {
	readonly rootPropertyName: string;
	readonly parentPropertyName: string;
	constructor(rootPropertyName: string = "Root", parentPropertyName: string = "Parent") {
		super();
		this.rootPropertyName = rootPropertyName;
		this.parentPropertyName = parentPropertyName;
	}
	shouldConvert(context: Entity, prop: Property): boolean {
		const shouldConvert = prop.name !== this.rootPropertyName && prop.name !== this.parentPropertyName
			&& isEntityType(prop.propertyType)
			&& (!!prop.propertyType.meta.getProperty(this.rootPropertyName) || !!prop.propertyType.meta.getProperty(this.parentPropertyName));
		return shouldConvert;
	}
	deserialize(context: Entity, value: any, prop: Property) {
		if (value && isEntityType(prop.propertyType)) {
			if (Array.isArray(value))
				value = value.map(item => this.deserialize(context, item, prop));
			else {
				// avoid modifying the provided object
				value = Object.assign({}, value);
				if (prop.propertyType.meta.getProperty(this.parentPropertyName))
					value[this.parentPropertyName] = context;
				if (prop.propertyType.meta.getProperty(this.rootPropertyName))
					value[this.rootPropertyName] = this.rootPropertyName in context
						? context[this.rootPropertyName]
						: context;
			}
		}
		return value;
	}
}
