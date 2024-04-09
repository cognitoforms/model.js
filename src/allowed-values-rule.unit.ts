import { createModel } from "./model";

import "./resource-en";

describe("AllowedValuesRule", () => {
	test("Prevent the setting of value if value is not in allowedValues list.", async () => {
		const { Test } = await createModel<{
			Test: {
				Choice: string;
			}
		}>({
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
		});
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