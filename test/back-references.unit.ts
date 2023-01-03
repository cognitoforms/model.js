/* eslint-disable no-new */
import { Entity } from "../src/entity";
import { IgnoreProperty, PropertyConverter, PropertySerializationResult } from "../src/entity-serializer";
import { Model } from "../src/model";
import { Property } from "../src/property";
import { isEntityType } from "../src/type";

class IgnorePropertyConverter extends PropertyConverter {
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

class InitializeBackReferencesConverter extends PropertyConverter {
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

function propagateRootProperty(parent: Entity, child: Entity, rootPropertyName: string = "Root") {
	// In case the parent's Root property is not yet set, propagate when it is set
	if (!parent[rootPropertyName])
		parent.meta.type.getProperty(rootPropertyName).changed.subscribeOne(e => (child[rootPropertyName] = e.newValue));
	else
		child[rootPropertyName] = parent[rootPropertyName];
}

function setBackReferenceProperties(parent: Entity, child: Entity, rootPropertyName: string = "Root", parentPropertyName: string = "Parent") {
	if (parentPropertyName in child) {
		child[parentPropertyName] = parent;
		propagateRootProperty(parent, child, rootPropertyName);
	}
	else
		child[rootPropertyName] = parent;
}

function ensureChildProperties(parent: Entity, propertyName: string, rootPropertyName: string = "Root", parentPropertyName: string = "Parent"): void {
	const value = parent.get(propertyName);
	if (Array.isArray(value)) {
		value.forEach(item => setBackReferenceProperties(parent, item, rootPropertyName, parentPropertyName));
	}
	else if (value) {
		setBackReferenceProperties(parent, value, rootPropertyName, parentPropertyName);
	}
}

describe("Back-reference properties", () => {
	describe("from a reference property", () => {
		let refPropModel: Model;
		beforeEach(() => {
			refPropModel = new Model({
				Person: {
					Skill: {
						type: "Skill",
						set: function() { return ensureChildProperties(this, "Skill"); },
						init() {
							return refPropModel.types["Skill"].createIfNotExists({});
						}
					}
				},
				Skill: {
					Name: String,
					Code: String,
					Root: {
						type: "Person"
					},
					Metadata: {
						type: "SkillMetadata",
						set: function() { return ensureChildProperties(this, "Metadata"); },
						init() {
							return refPropModel.types["SkillMetadata"].createIfNotExists({});
						}
					}
				},
				SkillMetadata: {
					Code: {
						type: String,
						format: {
							description: "AAA-000",
							expression: /^\s*([A-Z]+)-(\d)\s*$/g,
							message: "Code must be formatted as 'AAA-000'.",
							reformat: "$1-$2"
						},
						default: {
							dependsOn: "Parent.Code",
							function: function() { return this.Root ? this.Root.Skill ? this.Root.Skill.Code : null : null; }
						}
					},
					Root: {
						type: "Person"
					},
					Parent: {
						type: "Skill"
					}
				}
			}, {
				maxEventScopeDepth: 100,
				maxExitingEventScopeTransferCount: 500
			});

			refPropModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Root"));
			refPropModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Parent"));
			refPropModel.serializer.registerPropertyConverter(new InitializeBackReferencesConverter("Root", "Parent"));
		});

		it("can be established via property initializers", async () => {
			const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
			const instance = await refPropModel.types.Person.create({}) as any;
			expect(instance.Skill.Name).toBe(null);
			expect(consoleWarn).not.toBeCalled();
		});
	});

	describe("from a reference list property", () => {
		let refListModel: Model;
		beforeEach(() => {
			refListModel = new Model({
				Person: {
					Skills: {
						type: "Skill[]",
						init() {
							return [{ Owner: this, Name: "Skill 1" }, { Owner: this, Name: "Skill 2" }];
						}
					}
				},
				Skill: {
					Name: String,
					Id: {
						type: String,
						default() {
							return this.meta.id;
						}
					},
					Owner: {
						type: "Person"
					},
					ItemNumber: {
						type: Number,
						default: {
							dependsOn: "Owner.Skills",
							function() {
								return this.Owner ? this.Owner.Skills.indexOf(this) + 1 : -1;
							}
						}
					}
				}
			});

			refListModel.serializer.registerPropertyConverter(new IgnorePropertyConverter("Owner"));
		});

		it("can be established via property initializers", async () => {
			const instance = await refListModel.types.Person.create({ Skills: [{ Name: "Skill 3" }, { Name: "Skill 4" }] }) as any;
			expect(instance.serialize().Skills).toMatchObject([{ Id: "+c1", Name: "Skill 3", ItemNumber: 1 }, { Id: "+c2", Name: "Skill 4", ItemNumber: 2 }]);
		});
	});
});
