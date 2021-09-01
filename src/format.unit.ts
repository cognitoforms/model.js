import { FormatError } from "./format-error";
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
		let form = await model.types.Form.create({});
		form.Text = "label1";
		var val = model.types.Form.jstype.$Number.format.convertBack("test") as FormatError;
		var error = val.createCondition(form, model.types.Form.jstype.$Number);

		expect(error.message).toBe("label1 must be formatted as #,###.");
		form.Text = "label2";
		expect(error.message).toBe("label2 must be formatted as #,###.");
	});
});