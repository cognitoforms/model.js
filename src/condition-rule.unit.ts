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
});