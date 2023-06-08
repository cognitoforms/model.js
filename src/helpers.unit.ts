import { merge } from "./helpers";

describe("merge", function () {
	it("merges two input objects into a single new object", () => {
		var obj1 = { a: 1 };
		var obj2 = { b: 2 };
		var result = merge(obj1, obj2);

		// Should have properties of both input objects
		expect(result).toEqual({ a: 1, b: 2 });

		// Should return a new object
		expect(result).not.toBe(obj1);
	});

	it("returns a copy of the input objects if only one object is provided", () => {
		var obj1 = { a: 1 };
		var result = merge(obj1);

		// Should have properties of both input objects
		expect(result).toEqual({ a: 1 });

		// Should return a new object
		expect(result).not.toBe(obj1);
	});

	it("merges as many objects as provided", () => {
		var obj1 = { a: 1 };
		var obj2 = { b: 2 };
		var obj3 = { c: 3 };
		var obj4 = { d: 4 };
		var result = merge(obj1, obj2, obj3, obj4);

		// Should have properties of both input objects
		expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });

		// Should return a new object
		expect(result).not.toBe(obj1);
	});

	it("properties of left-most input objects are overridden by subsequent input objects", () => {
		var obj1 = { a: 1, b: 1, c: 1, d: 1 };
		var obj2 = { b: 2, c: 2, d: 2 };
		var obj3 = { c: 3, d: 3 };
		var obj4 = { d: 4 };
		var result = merge(obj1, obj2, obj3, obj4);

		// Should have properties of both input objects
		expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });

		// Should return a new object
		expect(result).not.toBe(obj1);
	});
});
