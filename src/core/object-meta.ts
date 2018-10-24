import { Type } from "./type";
import { Entity } from "./entity";

export class ObjectMeta {

	readonly type: Type;
	readonly entity: Entity;
	
	id: string;
	isNew: boolean;

	_legacyId: string;

	constructor(type, entity) {
		this.type = type;
		this.entity = entity;
	}

	destroy() {
		this.type.unregister(this.entity);
	}
}
