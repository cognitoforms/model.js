import { createModel, ModelOfType } from "./model";

describe("Type", () => {
	test("identifier property is inherited from baseType", async () => {
		type Base = {
			Id: string;
		};

		type Sub = {
			// No additional properties
		};

		const model = await createModel<{
			Base: Base,
			Sub: Sub
		}>({
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

	describe("create", () => {
		it("should support multilevel async resolution", async () => {
			type Sibling = {
				Id: string;
				Name: string;
			};

			type Child = {
				Id: string;
				Sibling: Sibling;
				Name: string;
			};

			type Parent = {
				Id: string;
				Child: Child;
			};

			const model = await createModel<{
				Sibling: Sibling,
				Child: Child;
				Parent: Parent;
			}>({
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

			model.serializer.registerValueResolver((instance, prop, value) => {
				if (prop.name === "Child")
					return Promise.resolve({ Id: value, Name: "Child Name", Sibling: "5" });
				if (prop.name === "Sibling")
					return Promise.resolve({ Id: value, Name: "Sibling Name" });
			});

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			let parent = await model.types.Parent.create({ Child: "1" });
			expect((parent as any).Child.Sibling.Name).toBe("Sibling Name");
		});

		/**
	 * The core issue here was that any task queued on an InitializationContext as a result of a ready() callback
	 * would not prevent further processing of the waiting queue.
	 */
		it("should support multilevel async resolution within list items", async () => {
			type Lookup = {
				Id: string;
				Name: string;
			};

			type ListItem = {
				Lookup: Lookup;
			};

			type Parent = {
				Id: string;
				List: ListItem[];
			};

			const model = await createModel<{
				Lookup: Lookup;
				ListItem: ListItem;
				Parent: Parent;
			}>({
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

			model.serializer.registerValueResolver((instance, prop, value) => {
				if (db[prop.propertyType.name])
					return new Promise(resolve => setTimeout(() => resolve(db[prop.propertyType.name][value]), 10));
			});

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			await model.types.Parent.create({
				List: [
					{ Lookup: "a" },
					{ Lookup: "b" }
				]
			});
			const parent = await model.types.Parent.create({
				List: [
					{ Lookup: "a" },
					{ Lookup: "b" }
				]
			});
			expect((parent as any).List[1].Lookup.Name).toBe("Lookup B");
		});

		it("should throw error when asked to create an entity which already exists", async () => {
			type Entity = {
				Id: string;
				Name: string;
				Sibling: Entity
			};

			const model = await createModel<{
				Entity: Entity
			}>({
				Entity: {
					Id: { identifier: true, type: String },
					Name: String,
					Sibling: "Entity"
				}
			});

			await model.types.Entity.create({ Id: "x" });
			expect(() => model.types.Entity.create({ Id: "x" })).toThrow(/already exists/);
		});

		it("Extended properties have the correct type", async () => {
			type RootLeaf = {
				LeafId: number;
			};

			type Root = {
				Id: number;
				Leaf: RootLeaf;
			};

			type BranchLeaf = Partial<RootLeaf> & {
				LeafId: string;
			};

			type Branch = Partial<Root> & {
				Id: number;
				Leaf: BranchLeaf;
			};

			const model = await createModel<{
				"Root.Leaf": RootLeaf;
				Root: Root;
				"Branch.Leaf": BranchLeaf;
				Branch: Branch;
			}>({
				"Root.Leaf": {
					LeafId: {
						type: Number
					}
				},
				Root: {
					Id: {
						type: Number
					},
					Leaf: {
						type: "Root.Leaf"
					}
				},
				"Branch.Leaf": {
					$extends: "Root.Leaf",
					LeafId: {
						// TODO: New property with different type
						type: String as any
					}
				},
				// TODO: optional base type propeties
				Branch: {
					$extends: "Root",
					Leaf: {
						type: "Branch.Leaf"
					}
				}
			});
			const branch = await model.types.Branch.create({ Id: 1, Leaf: { LeafId: "1" } }) as any;
			expect(branch.meta.type.fullName).toBe("Branch");
			expect(branch.Leaf.meta.type.fullName).toBe("Branch.Leaf");
			expect(branch.Leaf.LeafId).toBe("1");
			expect(branch.serialize()).toStrictEqual({ Id: 1, Leaf: { LeafId: "1" } });
		});
	});

	describe("createIfNotExists", () => {
		type Entity = {
			Id: string;
			Name: string;
			Sibling: Entity;
		};

		let model: ModelOfType<{ Entity: Entity }>;
		beforeEach(async () => {
			model = await createModel<{
				Entity: Entity
			}>({
				Entity: {
					Id: { identifier: true, type: String },
					Name: String,
					Sibling: "Entity"
				}
			});
		});

		it("should create new instance if id is not known", () => {
			const entity = model.types.Entity.createIfNotExists({ Id: "x", Name: "Test123" });
			expect(entity.Id).toBe("x");
			expect(entity.Name).toBe("Test123");
		});

		it("should create new instance if id is not provided", () => {
			const entity = model.types.Entity.createIfNotExists({ Name: "Test123" });
			expect(entity.Id).toBeNull();
			expect(entity.Name).toBe("Test123");
		});

		it("should return known instance if id is known", () => {
			const known = model.types.Entity.createSync({ Id: "y", Name: "Test123" });
			expect(model.types.Entity.createIfNotExists({ Id: "y", Name: "New123" })).toBe(known);
			expect(known.Name).toBe("Test123");
		});
	});
});