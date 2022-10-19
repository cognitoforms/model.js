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
		let consoleOutputs = [];
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
		});
	});
});