import { EntityOfType, TEntityConstructor } from "./entity";
import { Model, ModelOptions } from "./model";

import "./resource-en";

function createModel(options: ModelOptions) {
	return new Promise((resolve) => {
		let model = new Model(options);
		model.ready(() => {
			resolve(model);
		});
	});
}

describe("ConditionRule", () => {
	test("Custom condition", async () => {
		type Namespace = {
			Test: Test;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Text: string;
		};

		await createModel({
			$namespace: Types as any,
			Test: {
				Text: {
					error: {
						dependsOn: "Text",
						code: "Text",
						function: function(this: Test) {
							if (((this ? this.Text : null) !== null)) {
								return "Test error message.";
							}
						}
					},
					type: String
				}
			}
		});
		var p = new Types.Test();
		expect(p.meta.conditions).toHaveLength(0);
		p.Text = "x";
		expect(p.meta.conditions).toHaveLength(1);
		expect(p.meta.conditions[0].condition.message).toBe("Test error message.");
	});

	test("Nested Property- Error appears on referenced field", async () =>{
		type Namespace = {
			Test: Test;
			Section: Section;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Section: Section;
			Text: string;
			Calculation: string;
		};

		type Section = {
			Text: string;
		};

		await createModel({
			$namespace: Types as any,
			Test: {
				Section: {
					type: "Section"
				},
				Calculation: {
					type: String,
					get: {
						dependsOn: "Section.Text",
						function() { return this.Section.Text; }
					},
					error: {
						dependsOn: "{Calculation, Section.Text}",
						function: function(this: EntityOfType<Test>) {
							if (((this ? this.Calculation : null) !== null)) {
								return "Test error message.";
							}
						},
						properties: ["Section.Text"],
						code: "Calc"
					}
				}
			},
			Section: {
				Text: {
					type: String
				}
			}
		});
		var testForm = new Types.Test({
			Section: new Types.Section()
		});
		expect(testForm.meta.conditions).toHaveLength(0);
		testForm.Section!.Text = "x";
		expect(testForm.meta.conditions).toHaveLength(1);
		expect(testForm.meta.conditions[0].condition.targets).toHaveLength(2);
	});
});
