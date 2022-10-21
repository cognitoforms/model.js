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

	describe("calculated list", async () => {
		let model;
		beforeEach(() => {
			model = new Model({
				Test: {
					Id: { identifier: true, type: String },
					Len: {
						type: Number,
						default: {
							function() {
								return this.Nums.length;
							},
							dependsOn: "Nums"
						}
					},
					Max: Number,
					Nums: {
						type: "Number[]",
						get: {
							function() {
								const list = [];
								for (let i = 0; i < this.Max; i++)
									list.push(i+1);
								return list;
							},
							dependsOn: "Max"
						}
					}
				}
			});
		});

		it("works", async () => {
			const test = await model.types.Test.create({}) as any;
			expect(test.Nums.length).toBe(0);
			expect(test.Len).toBe(0);
			test.Max = 3;
			expect(test.Nums.length).toBe(3);
			expect(test.Len).toBe(3);
		});

		it("does not publish change events for initial calculation", async () => {
			const test = await model.types.Test.create({ Id: "test", Max: 2, Len: 10 }) as any;
			expect(test.Nums.length).toBe(2);
			expect(test.Len).toBe(10);
		});
	});

	test("calculated list based on overridden property", async () => {
		const model = new Model({
			Action: {
				IsAllowed: Boolean,
				Name: String
			},
			SubmitAction: {
				$extends: "Action",
				IsAllowed: {
					type: Boolean,
					get: {
						function() {
							return this.Name.length > 3;
						},
						dependsOn: "Name"
					}
				}
			},
			Test: {
				Actions: "Action[]",
				AllowedActions: {
					type: "Action[]",
					get: {
						function() {
							return this.Actions.filter(a => a.IsAllowed);
						},
						dependsOn: "Actions{IsAllowed}"
					}
				}
			}
		});

		const test = await model.types.Test.create({}) as any;
		const submit = await model.types.SubmitAction.create({ Name: "Submit" }) as any;

		expect(test.AllowedActions).toHaveLength(0);
		test.Actions.push(submit);
		expect(test.AllowedActions).toHaveLength(1);
		submit.Name = "X";
		expect(test.AllowedActions).toHaveLength(0);
	});
});