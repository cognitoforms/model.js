import { TEntityConstructor } from "./entity";
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

describe("AllowedValuesRule", () => {
	test("Prevent the setting of value if value is not in allowedValues list.", async () => {
		type Namespace = {
			Test: Test;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Choice: string;
		};

		await createModel({
			$namespace: Types as any,
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
		var t = new Types.Test({ Choice: "First" });
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
