import { createEventObject } from "./events";
import { ArrayChangeType, ObservableArray, updateArray } from "./observable-array";

describe("ObservableArray", () => {
	it("should not publish change event for no changes", () => {
		const arr = ObservableArray.create([]);
		const changeHandler = jest.fn();
		arr.changed.subscribe(changeHandler);
		arr.batchUpdate(() => updateArray(arr, []));
		expect(changeHandler).not.toBeCalled();
	});
	describe("copyWithin", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/copyWithin
		it("shallow copies part of an array to another location in the same array and returns it without modifying its length", () => {
			const arr = ObservableArray.create(["a", "b", "c", "d", "e"]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			arr.copyWithin(0, 3, 4);
			expect(arr).toEqual(["d", "b", "c", "d", "e"]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.replace,
						startIndex: 3,
						endIndex: 4
					}
				]
			}));
		});
	});
	describe("fill", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill
		it("changes elements in an array to a static value", () => {
			const arr = ObservableArray.create([1, 2, 3, 4]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			arr.fill(0, 2, 4);
			expect(arr).toEqual([1, 2, 0, 0]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.replace,
						startIndex: 2,
						endIndex: 4
					}
				]
			}));
		});
	});
	describe("pop", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop
		it("removes the last element from an array and returns that element", () => {
			const arr = ObservableArray.create(["broccoli", "cauliflower", "cabbage", "kale", "tomato"]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var result = arr.pop();
			expect(result).toBe("tomato");
			expect(arr).toEqual(["broccoli", "cauliflower", "cabbage", "kale"]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.remove,
						startIndex: 4,
						endIndex: 4,
						items: ["tomato"]
					}
				]
			}));
		});
	});
	describe("push", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push
		it("adds the specified elements to the end of an array and returns the new length of the array", () => {
			const arr = ObservableArray.create(["pigs", "goats", "sheep"]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var result = arr.push("cows");
			expect(result).toBe(4);
			expect(arr).toEqual(["pigs", "goats", "sheep", "cows"]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.add,
						startIndex: 3,
						endIndex: 3,
						items: ["cows"]
					}
				]
			}));
		});
	});
	describe("reverse", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse
		it("reverses an array in place and returns the reference to the same array", () => {
			const arr = ObservableArray.create(["one", "two", "three"]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var reversed = arr.reverse();
			expect(reversed).toBe(arr);
			expect(arr).toEqual(["three", "two", "one"]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.reorder,
						startIndex: 0,
						endIndex: 2
					}
				]
			}));
		});
	});
	describe("shift", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift
		it("removes the first element from an array and returns that removed element", () => {
			const arr = ObservableArray.create([1, 2, 3]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var result = arr.shift();
			expect(result).toBe(1);
			expect(arr).toEqual([2, 3]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.remove,
						startIndex: 0,
						endIndex: 0,
						items: [1]
					}
				]
			}));
		});
	});
	describe("sort", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
		it("sorts the elements of an array in place and returns the reference to the same array, now sorted", () => {
			const arr = ObservableArray.create(["March", "Jan", "Feb", "Dec"]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var arr2 = arr.sort();
			expect(arr2).toBe(arr);
			expect(arr).toEqual(["Dec", "Feb", "Jan", "March"]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.reorder,
						startIndex: 0,
						endIndex: 3
					}
				]
			}));
		});
	});
	describe("splice", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
		it("changes the contents of an array by removing or replacing existing elements and/or adding new elements in place", () => {
			const arr = ObservableArray.create(["Jan", "Feb", "March", "April", "June"]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var removed = arr.splice(4, 1, "May");
			expect(removed).toEqual(["June"]);
			expect(arr).toEqual(["Jan", "Feb", "March", "April", "May"]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.remove,
						startIndex: 4,
						endIndex: 4,
						items: ["June"]
					},
					{
						type: ArrayChangeType.add,
						startIndex: 4,
						endIndex: 4,
						items: ["May"]
					}
				]
			}));
		});
	});
	describe("unshift", () => {
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift
		it("adds the specified elements to the beginning of an array and returns the new length of the array", () => {
			const arr = ObservableArray.create([1, 2, 3]);
			const changeHandler = jest.fn();
			arr.changed.subscribe(changeHandler);
			var result = arr.unshift(4, 5);
			expect(result).toBe(5);
			expect(arr).toEqual([4, 5, 1, 2, 3]);
			expect(changeHandler).toBeCalledWith(createEventObject({
				changes: [
					{
						type: ArrayChangeType.add,
						startIndex: 0,
						endIndex: 1,
						items: [4, 5]
					}
				]
			}));
		});
	});
});
