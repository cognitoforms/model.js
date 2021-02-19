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

describe("RequiredRule", () => {
	test("Required boolean", async () => {
		const model = await createModel({
			Test: {
				Text: {
					required: true,
					type: String
				}
			}
		}) as any;
		const Test = model.getJsType("Test");
		var t = new Test();
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Text is required.");
		t.Text = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required function", async () => {
		const model = await createModel({
			Test: {
				Text1: {
					required: {
						dependsOn: "Text2",
						function: function() { return ((this ? this.Text2 : null) !== null); }
					},
					type: String
				},
				Text2: {
					type: String
				}
			}
		}) as any;
		const Test = model.getJsType("Test");
		var t = new Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Text1 is required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});
});