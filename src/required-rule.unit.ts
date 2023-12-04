import { EntityOfType, TEntityConstructor } from "./entity";
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

describe("RequiredRule", () => {
	test("Required boolean", async () => {
		type Namespace = {
			Test: Test;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Text: string;
		};

		await createModel({
			$namespace: Types as any,
			Test: {
				Text: {
					required: true,
					type: String
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Text is required.");
		t.Text = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required function", async () => {
		type Namespace = {
			Test: Test;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Text1: string;
			Text2: string;
		};

		await createModel({
			$namespace: Types as any,
			Test: {
				Text1: {
					required: {
						dependsOn: "Text2",
						function() { return this.Text2 !== null; }
					},
					type: String
				},
				Text2: {
					type: String
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Text1 is required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required message function", async () => {
		type Namespace = {
			Test: Test;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Text1: string;
			Text2: string;
		};

		await createModel({
			$namespace: Types as any,
			Test: {
				Text1: {
					required: {
						dependsOn: "Text2",
						message(this: EntityOfType<Test>) {
							if (!this.Text1 && this.Text2)
								return "Custom required.";
						},
						function() {
							return !!this.Text2;
						}
					},
					type: String
				},
				Text2: {
					type: String
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Custom required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required function with custom message", async () => {
		type Namespace = {
			Test: Test;
		};

		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		type Test = {
			Text1: string;
			Text2: string;
		};

		await createModel({
			$namespace: Types as any,
			Test: {
				Text1: {
					required: {
						dependsOn: "Text2",
						function() { return this.Text2 !== null; },
						message: "Custom required."
					},
					type: String
				},
				Text2: {
					type: String
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Custom required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});
});