import { Model } from "./model";

describe("validation-rule", () => {
	test("functions which throw exceptions are considered valid", () => {
		const model = new Model({
			Test: {
				Prop: {
					type: String,
					error: {
						dependsOn: "",
						function() {
							throw new Error("error");
						}
					}
				}
			}
		});

		const instance = new model.types.Test.jstype();
		expect(instance.meta.conditions.length).toBe(0);
	});
});