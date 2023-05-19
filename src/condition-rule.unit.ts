import { Model } from "./model";

import "./resource-en";

function createModel(options) {
	return new Promise((resolve) => {
		let model = new Model(options);
		model.ready(() => {
			resolve(model);
		});
	});
}

describe("ConditionRule", () => {
	test("Custom condition", async () => {
		const model = await createModel({
			Test: {
				Text: {
					error: {
						dependsOn: "Text",
						code: "Text",
						function: function() {
							if (((this ? this.Text : null) !== null)) {
								return "Test error message.";
							}
						}
					},
					type: String
				}
			}
		}) as any;
		const Test = model.getJsType("Test");
		var p = new Test();
		expect(p.meta.conditions).toHaveLength(0);
		p.Text = "x";
		expect(p.meta.conditions).toHaveLength(1);
		expect(p.meta.conditions[0].condition.message).toBe("Test error message.");
	});

	test("Nested Property- Error appears on referenced field", async () =>{
		const model = await createModel({
			Test: {
				Section: {
					type: "Section",
					Test: {
						type: String
					}
				},
				Calculation: {
					type: String,
					get: {
						dependsOn: "Section.Text",
						function() { return this.Section.Text; }
					},
					error: {
						dependsOn: "{Calculation, Section.Text}",
						function: function() {
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
		}) as any;
		const Test = model.getJsType("Test");
		const Section = model.getJsType("Section");
		var testForm = new Test({
			Section: new Section()
		});
		expect(testForm.meta.conditions).toHaveLength(0);
		testForm.Section.Text = "x";
		expect(testForm.meta.conditions).toHaveLength(1);
		expect(testForm.meta.conditions[0].condition.targets).toHaveLength(2);
	});
});