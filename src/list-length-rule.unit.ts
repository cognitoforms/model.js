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

describe("ListLengthRule", () => {
	test("Between", async () => {
		const model = await createModel({
			Test: {
				Array: {
					length: {
						min: 1,
						max: 2
					},
					type: "Test2[]"
				}
			},
			Test2: {
				Text: {
					type: String
				}

			}
		}) as any;
		const Test = model.getJsType("Test");
		const t = new Test();
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
		const model = await createModel({
			Test: {
				Array: {
					length: {
						min: 1
					},
					type: "Test2[]"
				}
			},
			Test2: {
				Text: {
					type: String
				}

			}
		}) as any;
		const Test = model.getJsType("Test");
		const t = new Test();
		expect(t.meta.conditions).toHaveLength(1);
		expect(t.meta.conditions[0].condition.message).toBe("Please specify at least 1 Array.");

		t.Array.push("1");
		expect(t.meta.conditions).toHaveLength(0);
	});

	test("Max", async () => {
		const model = await createModel({
			Test: {
				Array: {
					length: {
						max: 1
					},
					type: "Test2[]"
				}
			},
			Test2: {
				Text: {
					type: String
				}

			}
		}) as any;
		const Test = model.getJsType("Test");
		const t = new Test();
		expect(t.meta.conditions).toHaveLength(0);

		t.Array.push("1");
		expect(t.meta.conditions).toHaveLength(0);

		t.Array.push("2");
		expect(t.meta.conditions).toHaveLength(1);
		expect(t.meta.conditions[0].condition.message).toBe("Please specify no more than 1 Array.");
	});
});