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

	/**
	 * The core issue here was that any task queued on an InitializationContext as a result of a ready() callback
	 * would not prevent further processing of the waiting queue.
	 */
	test("createOrUpdate should support multilevel async resolution within list items", async () => {
		const model = new Model({
			Lookup: {
				Id: { identifier: true, type: String },
				Name: String
			},
			ListItem: {
				Lookup: "Lookup"
			},
			Parent: {
				Id: { identifier: true, type: String },
				List: "ListItem[]"
			}
		});

		const db = {
			Lookup: {
				"a": { Id: "a", Name: "Lookup A" },
				"b": { Id: "B", Name: "Lookup B" }
			}
		};

		const valueResolver = (instance, prop, value) => {
			if (db[prop.propertyType.name])
				return new Promise(resolve => setTimeout(() => resolve(db[prop.propertyType.name][value]), 10));
		};
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		await model.types.Parent.create({
			List: [
				{ Lookup: "a" },
				{ Lookup: "b" }
			]
		}, valueResolver);
		const parent = await model.types.Parent.create({
			List: [
				{ Lookup: "a" },
				{ Lookup: "b" }
			]
		}, valueResolver);
		expect(parent.List[1].Lookup.Name).toBe("Lookup B");
	});

	test("createOrUpdate should support circular async resolution after entities already exist", async () => {
		const model = new Model({
			Entity: {
				Id: { identifier: true, type: String },
				Name: String,
				Sibling: "Entity"
			}
		});

		const entities = {
			a: {
				Id: "a",
				Name: "Entity A",
				Sibling: "b"
			},
			b: {
				Id: "b",
				Name: "Entity B",
				Sibling: "a"
			}
		};

		const siblingResolver = (instance, prop, value) => {
			if (prop.name === "Sibling")
				return new Promise(resolve => setTimeout(() => resolve(entities[value]), 10));
		};

		// ensure entity instances already exist and are pooled
		await model.types.Entity.create(entities.a, siblingResolver);
		let root = await model.types.Entity.create(entities.a, siblingResolver);
		expect(root.Sibling.Sibling).toBe(root);
	});
});