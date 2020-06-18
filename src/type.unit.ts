import { Model } from "./model";

describe("Type", () => {
	test("identifier property is inherited from baseType", () => {
		const model = new Model({
			Base: {
				Id: {
					identifier: true,
					type: String
				}
			},
			Sub: {
				$extends: "Base"
			}
		});
        
		expect(model.types.Sub.identifier).toBe(model.types.Base.identifier);
	});

	test("createOrUpdate should support multilevel async resolution", async () => {
		const model = new Model({
			Sibling: {
				Id: { identifier: true, type: String },
				Name: String
			},
			Child: {
				Id: { identifier: true, type: String },
				Sibling: "Sibling",
				Name: String
			},
			Parent: {
				Id: { identifier: true, type: String },
				Child: "Child"
			}
		});

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let parent = await model.types.Parent.create({ Child: "1" }, (instance, prop, value) => {
			if (prop.name === "Child")
				return Promise.resolve({ Id: value, Name: "Child Name", Sibling: "5" });
			if (prop.name === "Sibling")
				return Promise.resolve({ Id: value, Name: "Sibling Name" });
		});
		expect(parent.Child.Sibling.Name).toBe("Sibling Name");
	});
});