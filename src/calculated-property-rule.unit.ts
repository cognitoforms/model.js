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

describe("CalculateRule", () => {
	test("Errors thrown in calculated rules are displayed to the user.", async () => {
		let consoleOutputs = [];
		window.console.warn = jest.fn((s)=> consoleOutputs.push(s.toString()));
		const model = await createModel({
			Test: {
				Choice: {
					default: {
						dependsOn: "Text",
						function: function() { return (this ? this.Text : null); }
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
});