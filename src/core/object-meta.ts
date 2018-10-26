import { Type } from "./type";
import { Entity } from "./entity";

export class ObjectMeta {

	readonly type: Type;
	readonly entity: Entity;
	
	id: string;
	isNew: boolean;

	_legacyId: string;

	constructor(type: Type, entity: Entity, id: string, isNew: boolean) {
		Object.defineProperty(this, "type", { value: type, writable: false, enumerable: true, configurable: false });
		Object.defineProperty(this, "entity", { value: entity, writable: false, enumerable: true, configurable: false });
		Object.defineProperty(this, "id", { value: id, writable: true, enumerable: true, configurable: false });
		Object.defineProperty(this, "isNew", { value: isNew, writable: true, enumerable: true, configurable: false });
	}

	destroy() {
		this.type.unregister(this.entity);

		// Raise the destroy event on this type and all base types
		for (var t: Type = this.type; t; t = t.baseType) {
			t._eventDispatchers.destroy.dispatch(t, { entity: this.entity });
		}
	}
}
