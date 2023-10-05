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

describe("ListLengthRule", () => {
	type Namespace = {
		Test: Test;
	};

	type Test = {
		Array: string[];
	};

	test("Between", async () => {
		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		await createModel({
			$namespace: Types as any,
			Test: {
				Array: {
					length: {
						min: 1,
						max: 2
					},
					type: "String[]"
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions).toHaveLength(1);
		expect(t.meta.conditions[0].condition.message).toBe("Please specify between 1 and 2 Array.");

		t.Array.push("1");
		expect(t.meta.conditions).toHaveLength(0);
		t.Array.push("2");
		expect(t.meta.conditions).toHaveLength(0);

		t.Array.push("3");
		expect(t.meta.conditions).toHaveLength(1);
		expect(t.meta.conditions[0].condition.message).toBe("Please specify between 1 and 2 Array.");
	});

	test("Min", async () => {
		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		await createModel({
			$namespace: Types as any,
			Test: {
				Array: {
					length: {
						min: 1
					},
					type: "String[]"
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions).toHaveLength(1);
		expect(t.meta.conditions[0].condition.message).toBe("Please specify at least 1 Array.");

		t.Array.push("1");
		expect(t.meta.conditions).toHaveLength(0);
	});

	test("Max", async () => {
		let Types: { [T in keyof Namespace]: TEntityConstructor<Namespace[T]> } = {} as any;

		await createModel({
			$namespace: Types as any,
			Test: {
				Array: {
					length: {
						max: 1
					},
					type: "String[]"
				}
			}
		});

		const t = new Types.Test();
		expect(t.meta.conditions).toHaveLength(0);

		t.Array.push("1");
		expect(t.meta.conditions).toHaveLength(0);

		t.Array.push("2");
		expect(t.meta.conditions).toHaveLength(1);
		expect(t.meta.conditions[0].condition.message).toBe("Please specify no more than 1 Array.");
	});
});
