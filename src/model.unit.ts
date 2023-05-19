import { Entity, EntityConstructorForType } from "./entity";
import { createEventObject } from "./events";
import { Model, normalize } from "./model";
import { ArrayChangeType } from "./observable-array";
import "./resource-en";

describe("normalize", () => {
	it("returns the time portion of the given date if the format is 't'", async () => {
		const ts = new Date(Date.UTC(2020, 7, 18, 9, 37, 57, 175));
		const normal = normalize(ts, "t");

		expect(normal.getFullYear()).toBe(1970);
		expect(normal.getMonth()).toBe(0);
		expect(normal.getDate()).toBe(1);

		expect(normal.getHours()).toBe(ts.getHours());
		expect(normal.getMinutes()).toBe(ts.getMinutes());
		expect(normal.getSeconds()).toBe(ts.getSeconds());
	});

	it("returns the day portion of the given date if the format is 'd'", async () => {
		const ts = new Date(Date.UTC(2020, 7, 18, 9, 37, 57, 175));
		const normal = normalize(ts, "d");

		expect(normal.getFullYear()).toBe(ts.getFullYear());
		expect(normal.getMonth()).toBe(ts.getMonth());
		expect(normal.getDate()).toBe(ts.getDate());

		expect(normal.getHours()).toBe(0);
		expect(normal.getMinutes()).toBe(0);
		expect(normal.getSeconds()).toBe(0);
	});
});

interface Test extends Entity {
	PropertyOne: string;
	List: string[];
}

function createModel(config = {}) {
	return new Model({
		Test: {
			PropertyOne: String,
			List: "String[]"

		}
	}, config);
}

describe("settings", () => {
	describe("autogeneratePropertyLabels", () => {
		it("is enabled by default", () => {
			const model = createModel();
			expect(model.settings.autogeneratePropertyLabels).toBe(true);
		});

		it("enabled: causes property labels to be generated", () => {
			const model = createModel({ autogeneratePropertyLabels: true });

			const property = model.types["Test"].properties[0];
			expect(property.label).toBe("Property One");
		});

		it("disabled: does not cause property labels to be generated", () => {
			const model = createModel({ autogeneratePropertyLabels: false });

			const property = model.types["Test"].properties[0];
			expect(property.label).toBeUndefined();
		});
	});
});

describe("Global Events", () => {
	describe("afterPropertySet", async () => {
		it("is called after a property set on any entity", async () => {
			const model = createModel();
			const mockFn = jest.fn();
			model.afterPropertySet.subscribe(mockFn);
			const Test = model.getJsType("Test") as EntityConstructorForType<Test>;

			var entity = new Test();
			var property = Test.meta.getProperty("PropertyOne");
			entity.PropertyOne = "test";

			expect(mockFn).toBeCalledWith(createEventObject({ entity, newValue: "test", oldValue: null, property }));
		});

		it("is called with additional arguments when specified for a property change", async () => {
			const model = createModel();
			const mockFn = jest.fn();
			model.afterPropertySet.subscribe(mockFn);
			const Test = model.getJsType("Test") as EntityConstructorForType<Test>;

			var entity = new Test();
			var property = Test.meta.getProperty("PropertyOne");
			property.value(entity, "test", { test: 42 });

			expect(mockFn).toBeCalledWith(createEventObject({ entity, newValue: "test", oldValue: null, property: property, test: 42 }));
		});
	});

	describe("entityRegistered", async () => {
		it("is called when any entity is created and registered", async () => {
			const model = createModel();
			const mockFn = jest.fn();
			model.entityRegistered.subscribe(mockFn);
			const Test = model.getJsType("Test") as EntityConstructorForType<Test>;

			var entity = new Test();

			expect(mockFn).toBeCalledWith(createEventObject({ entity }));
		});
	});

	describe("listChanged", async () => {
		it("is called when a list property is changed on any entity", async () => {
			const model = createModel();
			const mockFn = jest.fn();
			model.listChanged.subscribe(mockFn);
			const Test = model.getJsType("Test") as EntityConstructorForType<Test>;

			var entity = new Test();
			var property = Test.meta.getProperty("List");
			entity.List.push("test");

			expect(mockFn).toBeCalledWith(createEventObject({
				entity,
				property,
				newValue: entity.List,
				collectionChanged: true,
				changes: expect.arrayContaining([{
					type: ArrayChangeType.add,
					startIndex: 0,
					endIndex: 0,
					items: ["test"]
				}])
			}));
		});

		it("is called with additional arguments when specified for a list change", async () => {
			const model = createModel();
			const mockFn = jest.fn();
			model.listChanged.subscribe(mockFn);
			const Test = model.getJsType("Test") as EntityConstructorForType<Test>;

			var entity = new Test();
			var property = Test.meta.getProperty("List");
			property.value(entity, entity.List.concat(["test"]), { test: 42 });

			expect(mockFn).toBeCalledWith(createEventObject({
				entity,
				property,
				newValue: entity.List,
				collectionChanged: true,
				changes: expect.arrayContaining([{
					type: ArrayChangeType.add,
					startIndex: 0,
					endIndex: 0,
					items: ["test"]
				}]),
				test: 42
			}));
		});
	});
});
