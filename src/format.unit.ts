import { FormatError } from "./format-error";
import { CultureInfo } from "./globalization";
import { Model } from "./model";
import "./resource-en";

describe("format", () => {
	test("format on type does not cause error when creating model", () => {
		expect(() => new Model({
			$resources: { "en": { "string-format-alphabetic": "zzzzz" } } as any,
			"Form": {
				$format: "[Text]",
				Text: {
					label: "Untitled",
					type: String
				},
				Table: {
					label: "Untitled",
					type: "Form.Table[]"
				}
			},
			"Form.Table": {
				Text: {
					label: "[Text]",
					labelSource: "Form",
					format: {
						reformat: "$&",
						expression: /^([A-Za-z]+)$/,
						message: "string-format-alphabetic",
						description: "Test Format"
					},
					type: String
				},
				Form: {
					label: "Form",
					format: "[Text]",
					type: "Form"
				}
			}
		})).not.toThrow();
	});

	test("Format errors where the label has a token stay updated", async () => {
		let model = new Model({
			Form: {
				Text: {
					label: "Text",
					type: String
				},
				Number: {
					label: "[Text]",
					default: null,
					format: "N0",
					type: Number
				}
			}
		});
		let form = await model.types.Form.create({}) as any;
		form.Text = "label1";
		var val = model.types.Form.getProperty("Number").format.convertBack("test") as FormatError;
		var error = val.createCondition(form, model.types.Form.getProperty("Number"));

		expect(error.message).toBe("label1 must be formatted as #,###.");
		form.Text = "label2";
		expect(error.message).toBe("label2 must be formatted as #,###.");
	});

	test("list items are formatted using the list property format", async () => {
		var model = new Model({
			"Form": {
				Table: {
					label: "table",
					type: "Form.Table[]",
					format: "[Text2]",
					default: () => [{
						Text1: "Text1",
						Text2: "Text2"
					},
					{
						Text1: "Text1",
						Text2: "Text2"
					}]
				}
			},
			"Form.Table": {
				Text1: String,
				Text2: String
			}
		});
		let form = await model.types.Form.create({}) as any;
		expect(form.toString("[Table]")).toBe("Text2, Text2");
	});

	describe("Date", () => {
		let model: Model;
		beforeEach(() => {
			CultureInfo.setup();
			model = new Model({
				$culture: "en-US",
				"Form": {
					DateTimeField: {
						label: "Date / Time",
						type: Date,
						format: " M/d/yyyy h:mm tt "
					},
					DateField: {
						label: "Date",
						type: Date,
						format: " M/d/yyyy "
					},
					TimeField: {
						label: "Time",
						type: Date,
						format: " h:mm tt "
					}
				}
			});
		});
		test("parses null or whitespace as null", async () => {
			let form = await model.types.Form.create({}) as any;
			let result = model.types.Form.getProperty("DateTimeField").format.convertBack(" ");
			expect(result).toBeNull();
			form.DateTimeField = result;
			expect(form.DateTimeField).toBeNull();
		});
		test("can be formatted as a date and time", async () => {
			let form = await model.types.Form.create({}) as any;
			form.DateTimeField = new Date(2021, 11, 10, 16, 38);
			expect(form.toString("[DateTimeField]")).toBe(" 12/10/2021 4:38 PM ");
		});
		test("can be parsed as a date and time", async () => {
			let form = await model.types.Form.create({}) as any;
			let result = model.types.Form.getProperty("DateTimeField").format.convertBack(" 12/10/2021 4:38 PM ");
			expect(result.constructor).toBe(Date);
			form.DateTimeField = result;
			expect(form.DateTimeField).toEqual(new Date(2021, 11, 10, 16, 38));
		});
		test("can be formatted as a date", async () => {
			let form = await model.types.Form.create({}) as any;
			form.DateField = new Date(2021, 11, 10);
			expect(form.toString("[DateField]")).toBe(" 12/10/2021 ");
		});
		test("can be parsed as a date", async () => {
			let form = await model.types.Form.create({}) as any;
			var result = model.types.Form.getProperty("DateField").format.convertBack(" 12/10/2021 ");
			expect(result.constructor).toBe(Date);
			form.DateField = result;
			expect(form.DateField).toEqual(new Date(2021, 11, 10));
		});
		test("can be formatted as a time", async () => {
			let form = await model.types.Form.create({}) as any;
			form.TimeField = new Date(1970, 0, 1, 16, 38);
			expect(form.toString("[TimeField]")).toBe(" 4:38 PM ");
		});
		test("can be parsed as a time", async () => {
			let form = await model.types.Form.create({}) as any;
			let result = model.types.Form.getProperty("TimeField").format.convertBack(" 4:38 PM ");
			form.TimeField = result;
			expect(form.TimeField).toEqual(new Date(1970, 0, 1, 16, 38));
		});
	});

	describe("Number", () => {
		let model: Model;
		beforeEach(() => {
			CultureInfo.setup();
			model = new Model({
				$culture: "en-US",
				"Form": {
					IntegerField: {
						label: "Integer",
						type: Number,
						format: "N0"
					},
					DecimalField: {
						label: "Decimal",
						type: Number,
						format: "N2"
					},
					PercentageField: {
						label: "Percentage",
						type: Number,
						format: "P1"
					}
				}
			});
		});
		test("parses null or whitespace as null", async () => {
			let form = await model.types.Form.create({}) as any;
			let result = model.types.Form.getProperty("IntegerField").format.convertBack(" ");
			expect(result).toBeNull();
			form.IntegerField = result;
			expect(form.IntegerField).toBeNull();
		});
		test("can be formatted as an integer", async () => {
			let form = await model.types.Form.create({}) as any;
			form.IntegerField = 3.14;
			expect(form.IntegerField).toBe(3.14);
			expect(form.toString("[IntegerField]")).toBe("3");
		});
		test("can be parsed as an integer", async () => {
			let form = await model.types.Form.create({}) as any;
			form.IntegerField = model.types.Form.getProperty("IntegerField").format.convertBack(" 3 ");
			expect(form.IntegerField).toBe(3);
		});
		test("can be formatted as a decimal", async () => {
			let form = await model.types.Form.create({}) as any;
			form.DecimalField = 3;
			expect(form.DecimalField).toBe(3);
			expect(form.toString("[DecimalField]")).toBe("3.00");
		});
		test("can be parsed as a decimal", async () => {
			let form = await model.types.Form.create({}) as any;
			form.DecimalField = model.types.Form.getProperty("DecimalField").format.convertBack(" 3.14 ");
			expect(form.DecimalField).toBe(3.14);
		});
		test("can be formatted as a percentage", async () => {
			let form = await model.types.Form.create({}) as any;
			form.PercentageField = 0.2;
			expect(form.PercentageField).toBe(0.2);
			expect(form.toString("[PercentageField]")).toBe("20.0 %");
		});
		test("can be parsed as a percentage", async () => {
			let form = await model.types.Form.create({}) as any;
			form.PercentageField = model.types.Form.getProperty("PercentageField").format.convertBack(" 20 % ");
			expect(form.PercentageField).toBe(0.20);
		});
	});

	describe("Boolean", () => {
		let model: Model;
		beforeEach(() => {
			CultureInfo.setup();
			model = new Model({
				"Form": {
					BooleanField: {
						label: "Boolean",
						type: Boolean,
						format: "Yes ;No ",
						default: false
					}
				}
			});
		});
		test("parses null or whitespace as null", async () => {
			let form = await model.types.Form.create({}) as any;
			let result = model.types.Form.getProperty("BooleanField").format.convertBack(" ");
			expect(result).toBeNull();
			form.BooleanField = result;
			expect(form.BooleanField).toBeNull();
		});
		test("values are formatted using a two-part boolean property format", async () => {
			let form = await model.types.Form.create({}) as any;
			expect(form.toString("[BooleanField]")).toBe("No ");
		});

		test("boolean values can be parsed using the two-part boolean property format", async () => {
			let prop = model.types.Form.getProperty("BooleanField");
			expect(prop.format.convertBack("Yes ")).toBe(true);
		});
	});
});
