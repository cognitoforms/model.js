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

describe("StringFormatRule", ()=>{
	it("format", async () => {
		const model = await createModel({
			Name: {
				First: String,
				Last: String
			},
			Person: {
				Name: {
					type: "Name",
					format: "[First] [Last]"
				}
			}
		});
		const Person = model.getJsType("Person");
		const p = new Person({ Name: { First: "John", Last: "Doe" } });
		expect(p.toString("[Name]")).toBe("John Doe");
	});

	it("Description, reformat, expression", async () => {
		const model = await createModel({
			Test: {
				Phone: {
					format: {
						description: "###-###-#### x####",
						reformat: "($1) $2-$3$4",
						expression: /^\s*\(?([1-9][0-9][0-9])\)?[ -]?([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/
					},
					type: String
				}
			}
		});
		const Test = model.getJsType("Test");
		const p = new Test({ Phone: "1234567890" });
		expect(p.toString("[Phone]")).toBe("(123) 456-7890");
		p.Phone = "1234567890x1234";
		expect(p.toString("[Phone]")).toBe("(123) 456-7890x1234");
		p.Phone = "z";
		expect(p.meta.conditions[0].condition.message).toBe("Phone must be formatted as ###-###-#### x####.");
	});
});