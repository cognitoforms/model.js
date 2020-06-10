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
});