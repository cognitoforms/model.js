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
	test("property label included in error message", () => {
		const model = new Model({
			Test: {
				Prop: {
					type: String,
					error: {
						dependsOn: "",
						function() {
							return "Property {property} is not valid";
						}
					}
				}
			}
		});

		const instance = new model.types.Test.jstype();
		expect(instance.meta.conditions.length).toBe(1);
		expect(instance.meta.conditions[0].condition.message).toBe("Property Prop is not valid");
	});
	test("property label included in error message can be dynamic", () => {
		const model = new Model({
			Test: {
				Number: Number,
				Prop: {
					type: String,
					label: "Prop [Number]",
					error: {
						dependsOn: "",
						function() {
							return "Property {property} is not valid";
						}
					}
				}
			}
		});

		const instance = new model.types.Test.jstype({ Number: 1 });
		expect(instance.meta.conditions.length).toBe(1);
		expect(instance.meta.conditions[0].condition.message).toBe("Property Prop 1 is not valid");
		(instance as any).Number = 2;
		expect(instance.meta.conditions[0].condition.message).toBe("Property Prop 2 is not valid");
	});
	test("property label included in error message can be dynamic and use a custom source", () => {
		const model = new Model({
			Parent: {
				Name: String
			},
			Test: {
				Number: Number,
				Parent: {
					type: "Parent"
				},
				Prop: {
					type: String,
					label: "Prop owned by [Name]",
					labelSource: "Parent",
					error: {
						dependsOn: "",
						function() {
							return "Property {property} is not valid";
						}
					}
				}
			}
		});

		const parentInstance = new model.types.Parent.jstype({ Name: "Parent Object" });
		const instance = new model.types.Test.jstype({ Number: 1, Parent: parentInstance });
		expect(instance.meta.conditions.length).toBe(1);
		expect(instance.meta.conditions[0].condition.message).toBe("Property Prop owned by Parent Object is not valid");
		(instance as any).Parent.Name = "New Parent Object";
		expect(instance.meta.conditions[0].condition.message).toBe("Property Prop owned by New Parent Object is not valid");
	});
	test("function may return a non-string value that can be coerced to a string", () => {
		const model = new Model({
			Test: {
				Prop1: {
					type: String,
					error: {
						dependsOn: "",
						function(): string {
							return ["Error 1"] as unknown as string;
						}
					}
				},
				Prop2: {
					type: String,
					label: "Prop2 [Prop1]",
					error: {
						dependsOn: "",
						function(): string {
							return ["Error 2"] as unknown as string;
						}
					}
				}
			}
		});

		const instance = new model.types.Test.jstype();
		expect(instance.meta.conditions.length).toBe(2);
		expect(instance.meta.conditions[0].condition.message).toBe("Error 1");
		expect(instance.meta.conditions[1].condition.message).toBe("Error 2");
	});
});