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

describe("RangeRule", () => {
	it("can be configured with contant min and max values", async () => {
		const model = await createModel({
			Person: {
				FirstName: String,
				Age: {
					label: "[FirstName]'s age",
					type: Number,
					range: { min: 0, max: 99 }
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ FirstName: "Jane", Age: 50 });
		expect(p.meta.conditions.length).toBe(0); // initially within range

		p.Age = -5;
		expect(p.meta.conditions.length).toBe(1); // -5 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 0 and 99."); // -5 is out of range

		p.Age = 100;
		expect(p.meta.conditions.length).toBe(1); // 100 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 0 and 99."); // 100 is out of range

		p.Age = 99;
		expect(p.meta.conditions.length).toBe(0); // 99 is in range

		p.Age = 0;
		expect(p.meta.conditions.length).toBe(0); // 0 is in range

		p.Age = 50;
		expect(p.meta.conditions.length).toBe(0); // 50 is in range
	});

	it("can be configured with a constant min value (no max value)", async () => {
		const model = await createModel({
			Person: {
				FirstName: String,
				Age: {
					label: "[FirstName]'s age",
					type: Number,
					range: { min: 0 }
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ FirstName: "Jane", Age: 50 });
		expect(p.meta.conditions.length).toBe(0); // initially in range

		p.Age = -1;
		expect(p.meta.conditions.length).toBe(1); // -1 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be at least 0."); // -1 is out of range

		p.Age = 0;
		expect(p.meta.conditions.length).toBe(0); // 0 is in range

		p.Age = 100;
		expect(p.meta.conditions.length).toBe(0); // 100 is in range
	});

	it("can be configured with a constant max value (no min value)", async () => {
		const model = await createModel({
			Person: {
				FirstName: String,
				IsAdult: Boolean,
				IsCentenarian: Boolean,
				Age: {
					label: "[FirstName]'s age",
					type: Number,
					default: 0,
					range: { max: 17 }
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ FirstName: "Jane", Age: 1 });
		expect(p.meta.conditions.length).toBe(0); // initially in range

		p.Age = 19;
		expect(p.meta.conditions.length).toBe(1); // 19 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be at most 17."); // 19 is out of range

		p.Age = 18;
		expect(p.meta.conditions.length).toBe(1); // 18 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be at most 17."); // 18 is out of range

		p.Age = 17;
		expect(p.meta.conditions.length).toBe(0); // 17 is in range

		p.Age = 0;
		expect(p.meta.conditions.length).toBe(0); // 0 is in range
	});

	it("can be configured with function min and max values", async () => {
		const model = await createModel({
			Person: {
				FirstName: String,
				Age: {
					label: "[FirstName]'s age",
					type: Number,
					range: {
						min: function() { return 18; },
						max: function() { return 65; }
					}
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ FirstName: "Jane", Age: 50 });
		expect(p.meta.conditions.length).toBe(0); // initially in range

		p.Age = 17;
		expect(p.meta.conditions.length).toBe(1); // 17 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 18 and 65."); // 17 is out of range

		p.Age = 18;
		expect(p.meta.conditions.length).toBe(0); // 18 is in range

		p.Age = 66;
		expect(p.meta.conditions.length).toBe(1); // 66 is out of range
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 18 and 65."); // 66 is out of range

		p.Age = 65;
		expect(p.meta.conditions.length).toBe(0); // 65 is in range

		p.Age = 50;
		expect(p.meta.conditions.length).toBe(0); // 50 is in range
	});

	it("can be configured with dynamic function min and max values", async () => {
		const model = await createModel({
			Person: {
				FirstName: String,
				IsAdult: {
					type: Boolean,
					default: true
				},
				IsCentenarian: Boolean,
				Age: {
					label: "[FirstName]'s age",
					type: Number,
					range: {
						dependsOn: "IsAdult,IsCentenarian",
						min: function() {
							return this.IsAdult ? 18 : 0;
						},
						max: function() {
							return this.IsAdult ? this.IsCentenarian ? null : 99 : 17;
						}
					}
				}
			}
		});

		const Person = model.getJsType("Person");

		var p = new Person({ FirstName: "Jane", Age: 50 });
		expect(p.meta.conditions.length).toBe(0); // initially in range

		p.Age = 17;
		expect(p.meta.conditions.length).toBe(1); // 17 is out of range for "adult"
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 18 and 99."); // 17 is out of range for "adult"

		p.Age = 18;
		expect(p.meta.conditions.length).toBe(0); // 18 is in range for "adult"

		p.Age = 99;
		expect(p.meta.conditions.length).toBe(0); // 99 is in range for non-centenarian adult

		p.Age = 100;
		expect(p.meta.conditions.length).toBe(1); // 100 is out of range for non-centenarian adult
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 18 and 99."); // 100 is out of range for non-centenarian adult

		p.FirstName = "June";
		expect(p.meta.conditions.length).toBe(1); // 100 is out of range for non-centenarian adult
		expect(p.meta.conditions[0].condition.message).toBe("June's age must be between 18 and 99."); // 100 is out of range for non-centenarian adult

		p.FirstName = "Jane";

		p.IsCentenarian = true;
		expect(p.meta.conditions.length).toBe(0); // 100 is in range for centenarian adult

		p.IsCentenarian = false;
		p.IsAdult = false;
		expect(p.meta.conditions.length).toBe(1); // 100 is out of range for non-adult
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 0 and 17."); // 100 is out of range for non-adult

		p.Age = 18;
		expect(p.meta.conditions.length).toBe(1); // 18 is out of range for non-adult
		expect(p.meta.conditions[0].condition.message).toBe("Jane's age must be between 0 and 17."); // 18 is out of range for non-adult

		p.Age = 17;
		expect(p.meta.conditions.length).toBe(0); // 17 is in range for non-adult
	});
});
