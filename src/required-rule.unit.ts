import { createModel } from "./model";

import "./resource-en";

describe("RequiredRule", () => {
	test("Required boolean", async () => {
		const { Test } = await createModel<{
			Test: {
				Text: string;
			}
		}>({
			Test: {
				Text: {
					required: true,
					type: String
				}
			}
		});

		const t = new Test();
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Text is required.");
		t.Text = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required function", async () => {
		const { Test } = await createModel<{
			Test: {
				Text1: string;
				Text2: string;
			}
		}>({
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

		const t = new Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Text1 is required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required message function", async () => {
		const { Test } = await createModel<{
			Test: {
				Text1: string;
				Text2: string;
			};
		}>({
			Test: {
				Text1: {
					required: {
						dependsOn: "Text2",
						message() {
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

		const t = new Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Custom required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});

	test("Required function with custom message", async () => {
		const { Test } = await createModel<{
			Test: {
				Text1: string;
				Text2: string;
			}
		}>({
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

		const t = new Test();
		expect(t.meta.conditions.length).toBe(0);
		t.Text2 = "A";
		expect(t.meta.conditions.length).toBe(1);
		expect(t.meta.conditions[0].condition.message).toBe("Custom required.");
		t.Text1 = "A";
		expect(t.meta.conditions.length).toBe(0);
	});
});