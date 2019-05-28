import { Model } from "./model";

// Import English resources
import "./resource-en";

function createModel(options) {
	return new Promise((resolve) => {
		let model = new Model(options);
		model.ready(() => {
			resolve(model);
		});
	});
}

describe("StringLengthRule", () => {
	it("can be configured with contant min and max length", async () => {
		const model = await createModel({
			Person: {
				Name: {
					type: String,
					length: { min: 2, max: 9 }
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ Name: "Jane" });
		expect(p.meta.conditions.length).toBe(0); // initially within range

		p.Name = "J";
		expect(p.meta.conditions.length).toBe(1); // "J" is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 2 and 9 characters."); // "J" is out of range

		p.Name = "Jane Elizabeth";
		expect(p.meta.conditions.length).toBe(1); // "Jane Elizabeth" is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 2 and 9 characters."); // "Jane Elizabeth" is out of range

		p.Name = "Eliza Beth";
		expect(p.meta.conditions.length).toBe(1); // "Eliza Beth" is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 2 and 9 characters."); // "Eliza Beth" is out of range

		p.Name = "Elizabeth";
		expect(p.meta.conditions.length).toBe(0); // "Elizabeth" is in range
	});

	it("can be configured with a constant min value (no max value)", async () => {
		const model = await createModel({
			Person: {
				Name: {
					type: String,
					length: { min: 2 }
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ Name: "Jane" });
		expect(p.meta.conditions.length).toBe(0); // initially within range

		p.Name = "J";
		expect(p.meta.conditions.length).toBe(1); // "J" is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Name must be at least 2 characters."); // "J" is out of range

		p.Name = "Jane Elizabeth";
		expect(p.meta.conditions.length).toBe(0); // "Jane Elizabeth" is within range
	});

	it("can be configured with a constant max value (no min value)", async () => {
		const model = await createModel({
			Person: {
				Name: {
					type: String,
					length: { max: 9 }
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ Name: "Jane" });
		expect(p.meta.conditions.length).toBe(0); // initially within range

		p.Name = "J";
		expect(p.meta.conditions.length).toBe(0); // "J" is within range

		p.Name = "Jane Elizabeth";
		expect(p.meta.conditions.length).toBe(1); // "Jane Elizabeth" is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Name must be at most 9 characters."); // "Jane Elizabeth" is out of range
	});

	it("can be configured with dynamic function min and max values", async () => {
		const model = await createModel({
			Person: {
				IsFullName: Boolean,
				Name: {
					type: String,
					length: {
						dependsOn: "IsFullName",
						min: function() {
							return this.IsFullName ? 5 : 2;
						},
						max: function() {
							return this.IsFullName ? 19 : 9;
						},
					}
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ Name: "Jane" });
		expect(p.meta.conditions.length).toBe(0); // initially in range

		p.Name = "J";
		expect(p.meta.conditions.length).toBe(1); // "J" is out of range for first name
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 2 and 9 characters."); // "J" is out of range for first name

		p.Name = "Elizabeth Doe";
		expect(p.meta.conditions.length).toBe(1); // "Elizabeth Doe" is out of range for first name
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 2 and 9 characters."); // "Elizabeth Doe" is out of range for first name

		p.IsFullName = true;
		expect(p.meta.conditions.length).toBe(0); // "Elizabeth Doe" is in range for full name

		p.Name = "Elizabeth Margaret Doe";
		expect(p.meta.conditions.length).toBe(1); // "Elizabeth Margaret Doe" is out of range for full name
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 5 and 19 characters."); // "Elizabeth Margaret Doe" is out of range for full name

		p.Name = "M D";
		expect(p.meta.conditions.length).toBe(1); // "M D" is out of range for full name
		expect(p.meta.conditions[0].condition.message).toBe("Name must be between 5 and 19 characters."); // "M D" is out of range for full name

		p.Name = "Jane Doe";
		expect(p.meta.conditions.length).toBe(0); // "Jane Doe" is in range for first name
	});

});
