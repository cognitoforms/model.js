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
		var val = model.types.Form.jstype.$Number.format.convertBack("test") as FormatError;
		var error = val.createCondition(form, model.types.Form.jstype.$Number);

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
