import { FormatError } from "./format-error";
import { Entity } from "./entity";
import { ConditionType } from "./condition-type";
import { ConditionTarget } from "./condition-target";
import { PropertyPath } from "./property-path";
import { ObservableArray } from "./observable-array";
import { Property } from "./property";
import { Rule } from "./rule";
import { Format } from "./format";

export class Condition {
	type: ConditionType;
	message: string;
	targets: ObservableArray<ConditionTarget>;
	source: Rule | Format<any>;

	/**
		* Creates a condition of a specific type associated with one or more entities in a model.
		* @param type The type of condition, which usually is an instance of a subclass like Error, Warning or Permission.
		* @param message The optional message to use for the condition, which will default to the condition type message if not specified.
		* @param target The root target entity the condition is associated with.
		* @param properties The set of property paths specifying which properties and entities the condition should be attached to.
		*/
	constructor(type: ConditionType, message: string, target: Entity, source: Rule | Format<any>, properties: PropertyPath[] = []) {
		this.type = type;
		this.message = message || (type ? type.message : undefined);
		let targets = this.targets = ObservableArray.create<ConditionTarget>();
		this.source = source;

		// create targets if a root was specified
		if (target) {
			// process each property path to build up the condition sources
			for (let p = properties.length - 1; p >= 0; p--) {
				let path = properties[p];

				const targetInfos: { entity: Entity, properties: Property[] }[] = [];

				// build list of objects containing ConditionTarget information
				// we don't want to construct ConditionTargets as we're processing the path because we may not have gathered all targeted properties,
				// and the constructor triggers change on the entity meta's conditions list, which should be in a correct state before publishing the event
				path.each(target, (entity, property) => {
					// see if a target already exists for the current instance
					let targetInfo = targetInfos.find(t => t.entity === entity);

					// create the condition target if it does not already exist
					if (!targetInfo) {
						targetInfo = { entity, properties: [property] };
						targetInfos.push(targetInfo);
					}
					// otherwise, just ensure it references the current step
					else if (!targetInfo.properties.includes(property))
						targetInfo.properties.push(property);
				}, path.lastProperty);

				// construct the ConditionTargets here now that we've gathered all information
				targets.push(...targetInfos.map(i => new ConditionTarget(this, i.entity, i.properties)));
			}
		}

		// raise events for the new condition
		if (type !== FormatError.ConditionType) {
			let conditionType = type;

			// raise events on condition targets
			for (var t = targets.length - 1; t >= 0; t--) {
				let conditionTarget = targets[t];

				// type events
				for (var objectType = conditionTarget.target.meta.type; objectType != null; objectType = objectType.baseType) {
				 	// (objectType.conditionsChanged as Event<Type, ConditionTargetsChangedEventArgs>).publish(objectType, { conditionTarget: conditionTarget, add: true });
				}
			}

			// Add the condition to the corresponding condition type
			conditionType.conditions.push(this);

			// Add the condition to relevant condition type sets
			if (this.type.sets) {
				for (var s = this.type.sets.length - 1; s >= 0; s--) {
					this.type.sets[s].conditions.push(this);
				}
			}
		}
	}

	destroy(): void {
		/// <summary>Removes the condition targets from all target instances and raises condition change events.</summary>

		// raise events on condition type sets
		if (this.type.sets) {
			for (var s = this.type.sets.length - 1; s >= 0; s--) {
				var set = this.type.sets[s];
				let idx = set.conditions.indexOf(this);
				if (idx >= 0) {
					set.conditions.splice(idx, 1);
				}
			}
		}

		// raise events on condition types
		let idx = this.type.conditions.indexOf(this);
		if (idx >= 0) {
			this.type.conditions.splice(idx, 1);
		}

		for (var t = this.targets.length - 1; t >= 0; t--) {
			var conditionTarget = this.targets[t];
			var objectMeta = conditionTarget.target.meta;

			objectMeta.clearCondition(conditionTarget.condition.type);

			// type events
			for (var objectType = conditionTarget.target.meta.type; objectType != null; objectType = objectType.baseType) {
				// (objectType.conditionsChanged as Event<Type, ConditionTargetsChangedEventArgs>).publish(objectType, { conditionTarget: conditionTarget, add: false, remove: true });
			}
		}

		// remove references to all condition targets
		this.targets.splice(0);
	}

	toString(): string {
		return this.message;
	}
}

export interface ConditionConstructor {
	new(type: ConditionType, message: string, target: Entity, properties: string[]): Condition;
}

export interface ConditionsChangedEventArgs {
	condition: Condition;
	add?: boolean;
	remove?: boolean;
}
