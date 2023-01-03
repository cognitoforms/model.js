/* eslint-disable no-new */
import { Entity } from "./entity";
import { IgnoreProperty, PropertyConverter, PropertySerializationResult } from "./entity-serializer";
import { Model } from "./model";
import { Property } from "./property";
import { isEntityType } from "./type";

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

describe("Property", () => {
	it("can have a constant value", async () => {
		const model = new Model({
			Skill: {
				Name: String,
				Proficiency: {
					default() { return null; },
					type: Number
				}
			},
			Person: {
				Skills: {
					type: "Skill[]",
					constant: [{
						Name: "Climbing",
						Proficiency: 4
					}]
				}
			}
		});
		const instance = await model.types.Person.create({}) as any;
		expect(instance.Skills[0].Proficiency).toBe(4);
	});

	describe("set", () => {
		let model: Model;
		let fn: jest.Mock;
		beforeEach(() => {
			fn = jest.fn();
			model = new Model({
				Person: {
					Name: {
						type: String,
						set: fn
					}
				}
			});
		});

		it("function runs on property change", async () => {
			const instance = await model.types.Person.create({}) as any;
			instance.Name = "test";
			expect(fn).toBeCalledWith("test");
		});

		it("function runs on property init", async () => {
			(await model.types.Person.create({}));
			expect(fn).toBeCalledWith(null);
		});
	});

	describe("init", () => {
		describe("value property", () => {
			let valuePropModel: Model;

			beforeEach(() => {
				valuePropModel = new Model({
					Person: {
						Name: {
							type: String,
							init() {
								return "Test";
							}
						}
					}
				});
			});

			it("initializes value property", async () => {
				const instance = await valuePropModel.types.Person.create({}) as any;
				expect(instance.Name).toBe("Test");
			});

			it("does nothing if value property already initialized", async () => {
				const instance = await valuePropModel.types.Person.create({ Name: "John" }) as any;
				expect(instance.Name).toBe("John");
			});
		});

		describe("value list property", () => {
			let valueListModel: Model;
			beforeEach(() => {
				valueListModel = new Model({
					Person: {
						Skills: {
							type: "String[]",
							init() {
								return ["X", "Y"];
							}
						}
					}
				});
			});

			it("initializes", async () => {
				const instance = await valueListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toEqual(["X", "Y"]);
			});

			it("does nothing if already initialized", async () => {
				const instance = await valueListModel.types.Person.create({ Skills: [] }) as any;
				expect(instance.serialize().Skills).toEqual([]);
			});
		});

		describe("reference property", () => {
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

			it("initializes", async () => {
				const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
				const instance = await refPropModel.types.Person.create({}) as any;
				expect(instance.Skill.Name).toBe(null);
				expect(consoleWarn).not.toBeCalled();
			});

			it("does nothing if already initialized", async () => {
				const instance = await refPropModel.types.Person.create({ Skill: { Name: "Custom Skill" } }) as any;
				expect(instance.Skill.Name).toBe("Custom Skill");
			});
		});

		describe("reference list property", () => {
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

			it("initializes", async () => {
				const instance = await refListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toMatchObject([{ Name: "Skill 1" }, { Name: "Skill 2" }]);
			});

			it("does nothing if already initialized", async () => {
				const instance = await refListModel.types.Person.create({ Skills: [] }) as any;
				expect(instance.serialize().Skills).toMatchObject([]);
			});

			it("can be used to establish a back-reference", async () => {
				const instance = await refListModel.types.Person.create({ Skills: [{ Name: "Skill 3" }, { Name: "Skill 4" }] }) as any;
				expect(instance.serialize().Skills).toMatchObject([{ Id: "+c1", Name: "Skill 3", ItemNumber: 1 }, { Id: "+c2", Name: "Skill 4", ItemNumber: 2 }]);
			});
		});
	});
});