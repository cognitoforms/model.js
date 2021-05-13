import { createEventObject } from "./events";
import { Model, normalize } from "./model";
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

function createModel(config = {}) {
	return new Model({
		Test: {
			PropertyOne: String,
			List: "Test2[]"

		},
		Test2: {
			Text: {
				type: String
			}
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
	it("After property set", async () => {
		const model = createModel();
		const mockFn = jest.fn();
		model.afterPropertySet.subscribe(mockFn);
		const TestModel = model.getJsType("Test");

		var p = new TestModel();
		p.PropertyOne = "test";

		expect(mockFn).toBeCalledWith(createEventObject({ entity: p, newValue: "test", oldValue: null, property: model.types["Test"].properties[0] }));
	});

	it("Entity registered", async () => {
		const model = createModel();
		const mockFn = jest.fn();
		model.entityRegistered.subscribe(mockFn);
		const TestModel = model.getJsType("Test");

		var p = new TestModel();

		expect(mockFn).toBeCalledWith(createEventObject({ entity: p }));
	});

	it("List changed", async () => {
		const model = createModel();
		const mockFn = jest.fn();
		model.listChanged.subscribe(mockFn);
		const TestModel = model.getJsType("Test");

		var p = new TestModel();
		p.List.push("test");

		expect(mockFn).toBeCalledWith(createEventObject({ entity: p, property: model.types["Test"].properties[1], newValue: p.List }));
	});
});
