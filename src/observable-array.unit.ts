import { ObservableArray, updateArray } from "./observable-array";

describe("ObservableArray", () => {
	it("should not publish change event for no changes", () => {
		const arr = ObservableArray.create([]);
		const changeHandler = jest.fn();
		arr.changed.subscribe(changeHandler);
		arr.batchUpdate(() => updateArray(arr, []));
		expect(changeHandler).not.toBeCalled();
	});
});