import { Model, normalize, ModelConfiguration } from "./model";

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

describe("settings", () => {
	describe("autogeneratePropertyLabels", () => {
		function createModel(config: ModelConfiguration = {}) {
			return new Model({
				Type: {
					PropertyOne: String
				}
			}, config);
		}

		it("is enabled by default", () => {
			const model = createModel();
			expect(model.settings.autogeneratePropertyLabels).toBe(true);
		});

		it("enabled: causes property labels to be generated", () => {
			const model = createModel({ autogeneratePropertyLabels: true });

			const property = model.types["Type"].properties[0];
			expect(property.label).toBe("Property One");
		});

		it("disabled: does not cause property labels to be generated", () => {
			const model = createModel({ autogeneratePropertyLabels: false });

			const property = model.types["Type"].properties[0];
			expect(property.label).toBeUndefined();
		});
	});
});
