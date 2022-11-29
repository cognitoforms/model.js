/* eslint-disable no-new */
import { Model } from "./model";

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
});