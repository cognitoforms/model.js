import { Entity } from "../src/entity";

export function propagateRootProperty(parent: Entity, child: Entity, rootPropertyName: string = "Root") {
	// In case the parent's Root property is not yet set, propagate when it is set
	if (!parent[rootPropertyName])
		parent.meta.type.getProperty(rootPropertyName).changed.subscribeOne(e => (child[rootPropertyName] = e.newValue));
	else
		child[rootPropertyName] = parent[rootPropertyName];
}

export function setBackReferenceProperties(parent: Entity, child: Entity, rootPropertyName: string = "Root", parentPropertyName: string = "Parent") {
	if (parentPropertyName in child) {
		child[parentPropertyName] = parent;
		propagateRootProperty(parent, child, rootPropertyName);
	}
	else
		child[rootPropertyName] = parent;
}

export function ensureChildProperties(parent: Entity, propertyName: string, rootPropertyName: string = "Root", parentPropertyName: string = "Parent"): void {
	const value = parent.get(propertyName);
	if (Array.isArray(value)) {
		value.forEach(item => setBackReferenceProperties(parent, item, rootPropertyName, parentPropertyName));
	}
	else if (value) {
		setBackReferenceProperties(parent, value, rootPropertyName, parentPropertyName);
	}
}
