import { Type, TypeOfType } from "./type";
import { Entity, EntityOfType } from "./entity";
import { ConditionTarget } from "./condition-target";
import { ConditionType, PermissionConditionType } from "./condition-type";
import { ObservableArray } from "./observable-array";
import { FormatError } from "./format-error";
import { Rule } from "./rule";

export class ObjectMeta {
	readonly type: Type;
	readonly entity: Entity;

	readonly __pendingInvocation__: Rule[];

	id: string;
	isNew: boolean;

	conditions: ObservableArray<ConditionTarget>;

	constructor(type: Type, entity: Entity, id: string, isNew: boolean) {
		Object.defineProperty(this, "type", { enumerable: true, configurable: false, writable: false, value: type });
		Object.defineProperty(this, "entity", { enumerable: true, configurable: false, writable: false, value: entity });
		Object.defineProperty(this, "id", { enumerable: true, configurable: false, writable: true, value: id });
		Object.defineProperty(this, "isNew", { enumerable: true, configurable: false, writable: true, value: isNew });
		Object.defineProperty(this, "conditions", { enumerable: true, configurable: false, writable: true, value: ObservableArray.create<ConditionTarget>() });
		Object.defineProperty(this, "__pendingInvocation__", { enumerable: false, configurable: false, writable: false, value: [] });
	}

	/**
	 * Gets the condition target with the specified condition type
	 * @param conditionType The type of condition to retrieve
	 */
	getCondition(conditionType: ConditionType): ConditionTarget {
		return this.conditions.filter(c => c.condition.type === conditionType)[0];
	}

	/**
	 * Stores the condition target for the current instance
	 * @param conditionTarget The condition target to store
	 */
	setCondition(conditionTarget: ConditionTarget): void {
		if (conditionTarget.condition.type !== FormatError.ConditionType) {
			this.conditions.push(conditionTarget);
		}
	}

	/**
	 * Clears the condition for the current instance with the specified condition type
	 * @param conditionType The type of condition to clear
	 */
	clearCondition(conditionType: ConditionType): void {
		for (var i = 0; i < this.conditions.length; i++) {
			let conditionTarget = this.conditions[i];
			if (conditionTarget.condition.type === conditionType) {
				this.conditions.splice(i--, 1);
			}
		}
	}

	/**
	 * Determines if the set of permissions are allowed for the current instance
	 * @param codes The permission condition type code(s)
	 */
	isAllowed(...codes: string[]): boolean {
		// ensure each condition type is allowed for the current instance
		for (var c = codes.length - 1; c >= 0; c--) {
			var code = codes[c];
			var conditionType = ConditionType.get(code);

			// return undefined if the condition type does not exist
			if (conditionType === undefined) {
				return undefined;
			}

			// throw an exception if the condition type is not a permission
			if (!(conditionType instanceof PermissionConditionType)) {
				throw new Error("Condition type \"" + code + "\" should be a Permission.");
			}

			// return false if a condition of the current type exists and is a deny permission or does not exist and is a grant permission
			if (this.getCondition(conditionType) ? !conditionType.isAllowed : conditionType.isAllowed) {
				return false;
			}
		}

		return true;
	}
}

export interface ObjectMetaOfType<T> extends ObjectMeta {
	readonly type: TypeOfType<T>;
	readonly entity: EntityOfType<T>;
}
