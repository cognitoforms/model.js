/* eslint-disable no-new */
import { createEventObject } from "./events";
import { Model } from "./model";
import { ArrayChangeType } from "./observable-array";
import { Property$pendingInit } from "./property";

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
						},
						Name2: {
							type: String,
							init() {
								return null;
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

			it("sets pendingInit to false after initialization", async () => {
				const Person = valuePropModel.types.Person;
				const instance = await Person.create({}) as any;
				const property = Person.getProperty("Name");
				expect(instance.Name).toBe("Test");
				expect(Property$pendingInit(instance, property)).toBe(false);
			});

			// BUG: Currently, pendingInit is set to true if the value is the property's default, even if it has an initializer.
			// An initializer implies that it is responsible for initializing the property. Also, it should be mutually
			// exclusive with behavior that would leverage pending init (ex: calculation rules).
			it.skip("sets pendingInit to false after initialization the property's default value", async () => {
				const Person = valuePropModel.types.Person;
				const instance = await Person.create({}) as any;
				const property = Person.getProperty("Name2");
				expect(instance.Name2).toBeNull();
				expect(Property$pendingInit(instance, property)).toBe(false);
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
			let refPropModel: Model;
			beforeEach(() => {
				refPropModel = new Model({
					Person: {
						Skill: {
							type: "Skill",
							init() {
								return { Name: "Skill 1" };
							}
						}
					},
					Skill: { Name: String }
				});
			});

			it("initializes", async () => {
				const instance = await refPropModel.types.Person.create({}) as any;
				expect(instance.Skill.Name).toBe("Skill 1");
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
								return [{ Name: "Skill 1" }, { Name: "Skill 2" }];
							}
						}
					},
					Skill: { Name: String }
				});
			});

			it("initializes", async () => {
				const instance = await refListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toMatchObject([{ Name: "Skill 1" }, { Name: "Skill 2" }]);
			});

			it("does nothing if already initialized", async () => {
				const instance = await refListModel.types.Person.create({ Skills: [] }) as any;
				expect(instance.serialize().Skills).toMatchObject([]);
			});
		});
	});

	describe("change event", () => {
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

			it("is raised when the property is changed", async () => {
				const instance = await valuePropModel.types.Person.create({}) as any;
				expect(instance.Name).toBe("Test");
				const property = valuePropModel.types.Person.getProperty("Name");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				await instance.update({ Name: "John" });
				expect(instance.Name).toBe("John");
				expect(changeHandler).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					newValue: "John",
					oldValue: "Test"
				}));
			});

			it("passes additional arguments when the property is changed", async () => {
				const instance = await valuePropModel.types.Person.create({}) as any;
				expect(instance.Name).toBe("Test");
				const property = valuePropModel.types.Person.getProperty("Name");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				property.value(instance, "John", { test: 42 });
				expect(instance.Name).toBe("John");
				expect(changeHandler).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					newValue: "John",
					oldValue: "Test",
					test: 42
				}));
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

			it("is raised when the list is changed", async () => {
				const instance = await valueListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toEqual(["X", "Y"]);
				const property = valueListModel.types.Person.getProperty("Skills");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				instance.Skills.splice(1, 1, "Z");
				expect(instance.Skills.slice()).toEqual(["X", "Z"]);
				expect(changeHandler).toBeCalledWith(
					expect.objectContaining({
						entity: instance,
						property,
						newValue: expect.arrayContaining(["X", "Z"]),
						collectionChanged: true,
						changes: expect.arrayContaining([
							{
								type: ArrayChangeType.remove,
								startIndex: 1,
								endIndex: 1,
								items: ["Y"]
							},
							{
								type: ArrayChangeType.add,
								startIndex: 1,
								endIndex: 1,
								items: ["Z"]
							}
						])
					})
				);
			});

			it("passes additional arguments when the list is changed", async () => {
				const instance = await valueListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toEqual(["X", "Y"]);
				const property = valueListModel.types.Person.getProperty("Skills");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				property.value(instance, ["X", "Z"], { test: 42 });
				expect(instance.Skills.slice()).toEqual(["X", "Z"]);
				expect(changeHandler).toBeCalledWith(
					expect.objectContaining({
						entity: instance,
						property,
						newValue: expect.arrayContaining(["X", "Z"]),
						collectionChanged: true,
						changes: expect.arrayContaining([
							{
								type: ArrayChangeType.remove,
								startIndex: 1,
								endIndex: 1,
								items: ["Y"]
							},
							{
								type: ArrayChangeType.add,
								startIndex: 1,
								endIndex: 1,
								items: ["Z"]
							}
						]),
						test: 42
					})
				);
			});
		});

		describe("reference property", () => {
			let refPropModel: Model;
			beforeEach(() => {
				refPropModel = new Model({
					Person: {
						Skill: {
							type: "Skill",
							init() {
								return { Name: "Skill 1" };
							}
						}
					},
					Skill: { Name: String }
				});
			});

			it("is raised when the property is changed", async () => {
				const instance = await refPropModel.types.Person.create({}) as any;
				const skill1 = instance.Skill;
				expect(instance.Skill).not.toBeNull();
				expect(instance.Skill.Name).toBe("Skill 1");
				const property = refPropModel.types.Person.getProperty("Skill");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				const skill2 = await refPropModel.types.Skill.create({ Name: "Skill 2" }) as any;
				await instance.update({ Skill: skill2 });
				expect(instance.Skill).toBe(skill2);
				expect(instance.Skill.Name).toBe("Skill 2");
				expect(changeHandler).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					newValue: skill2,
					oldValue: skill1
				}));
			});

			it("passes additional arguments when the property is changed", async () => {
				const instance = await refPropModel.types.Person.create({}) as any;
				const skill1 = instance.Skill;
				expect(instance.Skill).not.toBeNull();
				expect(instance.Skill.Name).toBe("Skill 1");
				const property = refPropModel.types.Person.getProperty("Skill");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				const skill2 = await refPropModel.types.Skill.create({ Name: "Skill 2" }) as any;
				property.value(instance, skill2, { test: 42 });
				expect(instance.Skill).toBe(skill2);
				expect(instance.Skill.Name).toBe("Skill 2");
				expect(changeHandler).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					newValue: skill2,
					oldValue: skill1,
					test: 42
				}));
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
								return [{ Name: "Skill 1" }, { Name: "Skill 2" }];
							}
						}
					},
					Skill: { Name: String }
				});
			});

			it("is raised when the list is changed", async () => {
				const instance = await refListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toEqual([{ Name: "Skill 1" }, { Name: "Skill 2" }]);
				const skill1 = instance.Skills[0];
				const skill2 = instance.Skills[1];
				const property = refListModel.types.Person.getProperty("Skills");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				const skill0 = await refListModel.types.Skill.create({ Name: "Skill 0" }) as any;
				instance.Skills.splice(0, 2, skill0);
				expect(instance.serialize().Skills).toEqual([{ Name: "Skill 0" }]);
				expect(changeHandler).toBeCalledWith(
					expect.objectContaining({
						entity: instance,
						property,
						newValue: expect.arrayContaining([skill0]),
						collectionChanged: true,
						changes: expect.arrayContaining([
							{
								type: ArrayChangeType.remove,
								startIndex: 0,
								endIndex: 1,
								items: expect.arrayContaining([skill1, skill2])
							},
							{
								type: ArrayChangeType.add,
								startIndex: 0,
								endIndex: 0,
								items: expect.arrayContaining([skill0])
							}
						])
					})
				);
			});

			it("passes additional arguments when a list is changed", async () => {
				const instance = await refListModel.types.Person.create({}) as any;
				expect(instance.serialize().Skills).toEqual([{ Name: "Skill 1" }, { Name: "Skill 2" }]);
				const skill1 = instance.Skills[0];
				const skill2 = instance.Skills[1];
				const property = refListModel.types.Person.getProperty("Skills");
				const changeHandler = jest.fn();
				property.changed.subscribe(changeHandler);
				const skill0 = await refListModel.types.Skill.create({ Name: "Skill 0" }) as any;
				property.value(instance, [skill0].concat([skill1, skill2]), { test: 42 });
				expect(instance.serialize().Skills).toEqual([{ Name: "Skill 0" }, { Name: "Skill 1" }, { Name: "Skill 2" }]);
				expect(changeHandler).toBeCalledWith(
					expect.objectContaining({
						entity: instance,
						property,
						newValue: expect.arrayContaining([skill0, skill1, skill2]),
						collectionChanged: true,
						changes: expect.arrayContaining([
							{
								type: ArrayChangeType.add,
								startIndex: 0,
								endIndex: 0,
								items: expect.arrayContaining([skill0])
							}
						]),
						test: 42
					})
				);
			});
		});
	});

	describe("pendingInit", () => {
		describe("value property", () => {
			let valuePropModel: Model;

			beforeAll(() => {
				valuePropModel = new Model({
					Person: {
						Id: {
							type: String,
							identifier: true
						},
						Name: {
							type: String
						}
					}
				});
			});

			it("is true for a new object without a provided value", async () => {
				const Person = valuePropModel.types.Person;
				const instance = await Person.create({}) as any;
				const property = Person.getProperty("Name");
				expect(instance.Name).toBeNull();
				expect(Property$pendingInit(instance, property)).toBe(true);
			});

			it("is false for a new object with a provided value", async () => {
				const Person = valuePropModel.types.Person;
				const instance = await Person.create({ Name: "Test" }) as any;
				const property = Person.getProperty("Name");
				expect(instance.Name).toBe("Test");
				expect(Property$pendingInit(instance, property)).toBe(false);
			});

			it("is false for an existing object with a value", async () => {
				const Person = valuePropModel.types.Person;
				const instance = await Person.create({ Id: "3", Name: "Test" }) as any;
				const property = Person.getProperty("Name");
				expect(instance.Name).toBe("Test");
				expect(Property$pendingInit(instance, property)).toBe(false);
			});

			it("is true for an existing object without a value", async () => {
				const Person = valuePropModel.types.Person;
				const instance = await Person.create({ Id: "4" }) as any;
				const property = Person.getProperty("Name");
				expect(instance.Name).toBeNull();
				expect(Property$pendingInit(instance, property)).toBe(true);
			});
		});

		describe("calculated value property", () => {
			let calcValuePropModel: Model;

			beforeAll(() => {
				calcValuePropModel = new Model({
					Person: {
						Id: {
							type: String,
							identifier: true
						},
						Name: {
							type: String
						},
						Email: {
							type: String,
							get: {
								dependsOn: "Name",
								function() { return this.Name ? (this.Name.toLowerCase() + "@example.com") : null; }
							}
						}
					}
				});
			});

			// BUG: Rule code "Defer change notification until the scope of work has completed"
			// actually forces calculation by accessing the property.
			it.skip("is true for a new object until it is accessed", async () => {
				const Person = calcValuePropModel.types.Person;
				const instance = await Person.create({ Name: "Test" }) as any;
				const property = Person.getProperty("Email");
				expect(Property$pendingInit(instance, property)).toBe(true);
				expect(instance.Email).toBe("test@example.com");
				expect(Property$pendingInit(instance, property)).toBe(false);
			});

			// NOTE: Used as a stand-in for skipped test "is true for a new object until it is accessed" above
			it("is false for a new object after it is accessed", async () => {
				const Person = calcValuePropModel.types.Person;
				const instance = await Person.create({ Name: "Test" }) as any;
				const property = Person.getProperty("Email");
				expect(instance.Email).toBe("test@example.com");
				expect(Property$pendingInit(instance, property)).toBe(false);
			});

			it("is true for an existing object until it is accessed", async () => {
				const Person = calcValuePropModel.types.Person;
				const instance = await Person.create({ Id: "3", Name: "Test" }) as any;
				const property = Person.getProperty("Email");
				expect(Property$pendingInit(instance, property)).toBe(true);
				expect(instance.Email).toBe("test@example.com");
				expect(Property$pendingInit(instance, property)).toBe(false);
			});
		});

		describe("defaulted value property", () => {
			let defaultedValuePropModel: Model;

			beforeAll(() => {
				defaultedValuePropModel = new Model({
					Person: {
						Id: {
							type: String,
							identifier: true
						},
						Name: {
							type: String
						},
						Email: {
							type: String,
							default: {
								dependsOn: "Name",
								function() { return this.Name ? (this.Name.toLowerCase() + "@example.com") : null; }
							}
						}
					}
				});
			});

			it("is true for a new object without a provided value until accessed", async () => {
				const Person = defaultedValuePropModel.types.Person;
				const instance = await Person.create({}) as any;
				const property = Person.getProperty("Email");
				expect(Property$pendingInit(instance, property)).toBe(true);
				expect(instance.Email).toBeNull();
				expect(Property$pendingInit(instance, property)).toBe(false);
			});

			it("is false for a new object with a provided value", async () => {
				const Person = defaultedValuePropModel.types.Person;
				const instance = await Person.create({ Name: "Test", Email: "test.user@example.com" }) as any;
				const property = Person.getProperty("Email");
				expect(Property$pendingInit(instance, property)).toBe(false);
				expect(instance.Email).toBe("test.user@example.com");
			});

			it("is false for an existing object with a value", async () => {
				const Person = defaultedValuePropModel.types.Person;
				const instance = await Person.create({ Id: "3", Name: "Test", Email: "test.user@example.com" }) as any;
				const property = Person.getProperty("Email");
				expect(Property$pendingInit(instance, property)).toBe(false);
				expect(instance.Email).toBe("test.user@example.com");
			});

			it("is true for an existing object without a value until accessed", async () => {
				const Person = defaultedValuePropModel.types.Person;
				const instance = await Person.create({ Id: "4" }) as any;
				const property = Person.getProperty("Email");
				expect(Property$pendingInit(instance, property)).toBe(true);
				expect(instance.Email).toBeNull();
				expect(Property$pendingInit(instance, property)).toBe(false);
			});
		});
	});
});
