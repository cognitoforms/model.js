import { createModel } from "./model";

import "./resource-en";

describe("ConditionRule", () => {
	test("Custom condition", async () => {
		const { Test } = await createModel<{
			Test: {
				Text: string;
			}
		}>({
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
		});
		var p = new Test();
		expect(p.meta.conditions).toHaveLength(0);
		p.Text = "x";
		expect(p.meta.conditions).toHaveLength(1);
		expect(p.meta.conditions[0].condition.message).toBe("Test error message.");
	});

	test("Nested Property- Error appears on referenced field", async () =>{
		type Test = {
			Section: Section;
			Calculation: string;
		};

		type Section = {
			Text: string;
		};

		const { Test, Section } = await createModel<{ Test: Test, Section: Section }>({
			Test: {
				Section: {
					type: "Section"
				},
				Calculation: {
					type: String,
					get: {
						dependsOn: "Section.Text",
						function() { return this.Section!.Text; }
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
		});
		var testForm = new Test({
			Section: new Section()
		});
		expect(testForm.meta.conditions).toHaveLength(0);
		testForm.Section!.Text = "x";
		expect(testForm.meta.conditions).toHaveLength(1);
		expect(testForm.meta.conditions[0].condition.targets).toHaveLength(2);
	});
});