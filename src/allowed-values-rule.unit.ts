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

describe("AllowedValuesRule", () => {
	test("Prevent the setting of value if value is not in allowedValues list.", async () => {
		const model = await createModel({
			Test: {
				Choice: {
					allowedValues: {
						ignoreValidation: true,
						preventInvalidValues: true,
						function: function() { return ["First", "Second", "Third"]; }
					},
					type: String
				}
			}
		}) as any;
		const Test = model.getJsType("Test");
		var t = new Test({ Choice: "First" });
		try {
			t.Choice = "Second";
			expect(t.Choice).toBe("Second");
			t.Choice = "x";
			expect(true).toBe(false);
		}
		catch (e) {
			expect(e.message).toBe("Cannot set Choice, \"x\" is not an allowed value.");
		}
	});
});