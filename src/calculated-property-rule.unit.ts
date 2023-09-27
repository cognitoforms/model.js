import { Model, ModelLocalizationOptions, ModelNamespaceOption, ModelOptions } from "./model";

import "./resource-en";
import { EntityType, Type } from "./type";

function createModel(options: ModelOptions & ModelNamespaceOption & ModelLocalizationOptions) {
	return new Promise<Model>((resolve) => {
		let model = new Model(options);
		model.ready(() => {
			resolve(model);
		});
	});
}

describe("CalculateRule", () => {
	test("Errors thrown in calculated rules are displayed to the user.", async () => {
		let consoleOutputs: any[] = [];
		window.console.warn = jest.fn((s)=> consoleOutputs.push(s.toString()));
		const model = await createModel({
			Test: {
				Choice: {
					default: {
						dependsOn: "Text",
						function: function() { return (this ? this.get("Text") : null); }
					},
					allowedValues: {
						ignoreValidation: true,
						preventInvalidValues: true,
						function: function() { return ["First", "Second", "Third"]; }
					},
					type: String
				},
				Text: {
					type: String
				}
			}
		}) as any;
		const Test = model.getJsType("Test");
		var p = new Test({ Choice: "First", Text: "First" });

		p.Text = "x";

		expect(consoleOutputs).toEqual(["Error encountered while running rule \"Test.Choice.Calculated\".", "Error: Cannot set Choice, \"x\" is not an allowed value."]);
	});

	describe("default value calculation", () => {
		let model: Model;
		let TestEntity: Type;
		beforeEach(async () => {
			model = await createModel({
				Test: {
					Id: { type: String, identifier: true },
					Name: {
						type: String,
						default: {
							dependsOn: "Name2",
							function() {
								return this.get("Name2");
							}
						}
					},
					Name2: {
						type: String,
						default: "John Doe"
					},
					Num: {
						type: Number,
						default: 5
					},
					Num2: {
						type: Number,
						default: {
							dependsOn: "Num",
							function() { return this.get("Num"); }
						}
					},
					Text: String,
					CalculatedText: {
						type: String,
						get: {
							dependsOn: "Text",
							function() { return this.get("Text"); }
						}
					},
					DefaultedText: {
						type: String,
						default: {
							dependsOn: "CalculatedText",
							function() { return this.get("CalculatedText"); }
						}
					}
				}
			});
			TestEntity = (model.getJsType("Test") as EntityType).meta;
		});

		describe("on new instance", () => {
			it("can be based on other default value", async () => {
				const entity = await TestEntity.create({});

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBe("John Doe");
			});

			it("is overridden by non-null value provided during construction", async () => {
				const entity = await TestEntity.create({ Name: "New Name" });

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBe("New Name");
			});

			it("is overridden by null value provided during construction", async () => {
				const entity = await TestEntity.create({ Name: null });

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBeNull();
			});

			describe("number property", () => {
				it("is defaulted", async () => {
					const entity = await TestEntity.create({});
					expect(entity["Num"]).toBe(5);
				});

				it("is defaulted based on other defaulted property", async () => {
					const entity = await TestEntity.create({});
					expect(entity["Num2"]).toBe(5);
				});
			});
		});

		describe("on existing instance", () => {
			it("can be based on other default value", async () => {
				const entity = await TestEntity.create({ Id: "1" });

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBe("John Doe");
			});

			it("can be based on other default value", async () => {
				const entity = await TestEntity.create({ Id: "1" });

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBe("John Doe");
			});

			it("is overridden by non-null value provided during construction", async () => {
				const entity = await TestEntity.create({ Id: "1", Name: "New Name" });

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBe("New Name");
			});

			it("is overridden by null value provided during construction", async () => {
				const entity = await TestEntity.create({ Id: "1", Name: null });

				expect(entity["Name2"]).toBe("John Doe");
				expect(entity["Name"]).toBeNull();
			});

			it("updates when a dependent calculation changes", async () => {
				const entity = await TestEntity.create({ Id: "1", Text: null, DefaultedText: null });

				entity.update({ Text: "abc" });

				expect(entity["CalculatedText"]).toBe("abc");
				expect(entity["DefaultedText"]).toBe("abc");
			});
		});
	});

	describe("calculated list", () => {
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
								const list: any[] = [];
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