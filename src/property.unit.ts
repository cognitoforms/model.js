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
		it("initializes value property", async () => {
			const model = new Model({
				Person: {
					Name: {
						type: String,
						init() {
							return "Test";
						}
					}
				}
			});
			const instance = await model.types.Person.create({}) as any;
			expect(instance.Name).toBe("Test");
		});

		it("initializes value list property", async () => {
			const model = new Model({
				Person: {
					Skills: {
						type: "String[]",
						init() {
							return ["X", "Y"];
						}
					}
				}
			});
			const instance = await model.types.Person.create({}) as any;
			expect(instance.serialize().Skills).toEqual(["X", "Y"]);
		});

		it("initializes reference property", async () => {
			const model = new Model({
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
			const instance = await model.types.Person.create({}) as any;
			expect(instance.Skill.Name).toBe("Skill 1");
		});

		it("initializes reference list property", async () => {
			const model = new Model({
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
			const instance = await model.types.Person.create({}) as any;
			expect(instance.serialize().Skills).toMatchObject([{ Name: "Skill 1" }, { Name: "Skill 2" }]);
		});

		it("does nothing if value property already initialized", async () => {
			const model = new Model({
				Person: {
					Name: {
						type: String,
						init() {
							return "Test";
						}
					}
				}
			});
			const instance = await model.types.Person.create({ Name: "John" }) as any;
			expect(instance.Name).toBe("John");
		});

		it("does nothing if reference list already initialized", async () => {
			const model = new Model({
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
			const instance = await model.types.Person.create({ Skills: [] }) as any;
			expect(instance.serialize().Skills).toMatchObject([]);
		});
	});
});