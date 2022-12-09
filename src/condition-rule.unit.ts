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

	test("Nested Property", async () =>{
		const model = await createModel({
			Test: {
				Section: {
					type: "Section"
				},
				Text: {
					type: String,
					get: {
						dependsOn: "Section.Text",
						function() { return this.Section.Text; }
					},
					error: {
						dependsOn: "Calculation",
						function: function() {
							if (this.Calculation !== null)
								return "Calculation Error Message";
						}
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
						}
					}

				}
			},
			Section: {
				Text: {
					type: String
				}
			},
			Calculation: {
				type: String
			}
		}) as any;
		const Test = model.getJsType("Test");
		const Section = model.getJsType("Section");
		const Calc = model.getJsType("Calculation");
		var p = new Test({
			Section: new Section({ Text: null }),
			Calculation: new Calc("Test")
		});
		expect(p.meta.conditions).toHaveLength(0);
		p.Section.Text = "x";
		expect(p.meta.conditions).toHaveLength(2);
		expect(p.meta.conditions[0].condition.message).toBe("Calculation Error Message");
		expect(p.meta.conditions[1].condition.message).toBe("Test error message.");
	});
});