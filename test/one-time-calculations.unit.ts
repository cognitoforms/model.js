/* eslint-disable no-new */
import { Model } from "../src/model";
import { ensureChildProperties } from "./utils";
import { IgnorePropertyConverter } from "./ignore-property-converter";
import { InitializeBackReferencesConverter } from "./initialize-back-references-converter";
import { IdReferencePropertyConverter } from "./id-reference-property-converter";

require("../src/resource-en");

describe("One-time calculations", () => {
	let oneTimeCalcModel: Model;
	beforeEach(() => {
		oneTimeCalcModel = new Model({
			Person: {
				Name: String,
				Globals: {
					type: "Globals",
					init() { return { CurrentUserRole: "Anonymous", CurrentUserEmail: null }; }
				},
				ContactInfo: {
					type: "ContactInfo",
					init() { return { Root: this }; }
				},
				IsReadOnly: {
					type: Boolean,
					get: {
						function() { return /* this.Globals.CurrentUserRole != "Anonymous" && */ this.ContactInfo.Email != null; },
						dependsOn: "Globals{CurrentUserRole},ContactInfo.Email"
					}
				}
			},
			Globals: {
				CurrentUserRole: String,
				CurrentUserEmail: String
			},
			ContactInfo: {
				Root: {
					type: "Person"
				},
				Email: {
					type: String,
					default() { return this.Root.Globals.CurrentUserEmail; }
					// format: {
					// 	description: "name@address.xyz",
					// 	reformat: "$1",
					// 	// eslint-disable-next-line no-useless-escape
					// 	expression: /^\s*([a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+(\.[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+)*@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,64}|([0-9]{1,3}(\.[0-9]{1,3}){3})))\s*$/
					// }
				}
			}
		}, {
			maxEventScopeDepth: 100,
			maxExitingEventScopeTransferCount: 500
		});
	});

	it("do not calculate until all persisted data has been loaded", async () => {
		const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const instance = await oneTimeCalcModel.types.Person.create({
			Globals: {
				CurrentUserRole: "Public",
				CurrentUserEmail: "user@example.com"
			}
		}) as any;
		expect(consoleWarn).not.toBeCalled();
		expect(instance.ContactInfo.Email).toBe("user@example.com");
	});
});
