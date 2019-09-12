import { CultureInfo, formatDate, parseDate, formatNumber, parseNumber } from "./globalization";

// Set up culture so that all tests can use the invariant culture and en-US by default
CultureInfo.setup();

describe("globalize", function () {
	beforeEach(() => {
		CultureInfo.setup();
	});

	test("CultureInfo.setup()", () => {
		expect(CultureInfo.InvariantCulture).not.toBeNull();
		expect(CultureInfo.CurrentCulture).not.toBeNull();
	});

	describe("formatDate", function () {
		test("formatDate(date, 'g', 'CurrentCulture')", () => {
			expect(formatDate(new Date(2019, 1, 13, 11, 26, 34), "g", CultureInfo.CurrentCulture)).toBe("2/13/2019 11:26 AM");
		});
		test("formatDate(date, 'd', 'CurrentCulture')", () => {
			expect(formatDate(new Date(2019, 1, 13, 11, 26, 34), "d", CultureInfo.CurrentCulture)).toBe("2/13/2019");
		});
		test("formatDate(date, 't', 'CurrentCulture')", () => {
			expect(formatDate(new Date(2019, 1, 13, 11, 26, 34), "t", CultureInfo.CurrentCulture)).toBe("11:26 AM");
		});
	});

	describe("parseDate", function () {
		test("parseDate('#/##/####', 'CurrentCulture')", () => {
			expect(+parseDate("2/13/2019", CultureInfo.CurrentCulture)).toBe(+(new Date(2019, 1, 13)));
		});
		test("parseDate('####-##-##', 'CurrentCulture')", () => {
			debugger;
			expect(parseDate("2019-02-13", CultureInfo.CurrentCulture)).toBeNull();
		});
		test("parseDate('####-##-##', 'CurrentCulture', ['yyyy-MM-dd'])", () => {
			debugger;
			expect(+parseDate("2019-02-13", CultureInfo.CurrentCulture, ["yyyy-MM-dd"])).toBe(+(new Date(2019, 1, 13)));
		});
		test("parseDate('M/dd/yyyy hh:mm AM', 'CurrentCulture', 'g')", () => {
			expect(+parseDate("2/13/2019 11:26 AM", CultureInfo.CurrentCulture, "g")).toBe(+(new Date(2019, 1, 13, 11, 26)));
		});
		test("parseDate('#/##/####', 'CurrentCulture', 'd')", () => {
			expect(+parseDate("2/13/2019", CultureInfo.CurrentCulture, "d")).toBe(+(new Date(2019, 1, 13)));
		});
		test("parseDate('hh:mm AM', 'CurrentCulture', 't')", () => {
			expect(+parseDate("11:26 AM", CultureInfo.CurrentCulture, "t")).toBe(+(new Date(1970, 0, 1, 11, 26)));
		});
	});

	describe("formatNumber", () => {
		test("formatNumber(#, 'n'", () => {
			expect(formatNumber(3.14, "n", CultureInfo.CurrentCulture)).toBe("3.14");
		});
		test("formatNumber-n0", () => {
			expect(formatNumber(3.14, "n0", CultureInfo.CurrentCulture)).toBe("3");
		});
		test("formatNumber-n1", () => {
			expect(formatNumber(3.14, "n1", CultureInfo.CurrentCulture)).toBe("3.1");
		});
	});

	describe("parseNumber", () => {
		test("parseNumber('#.##')", () => {
			expect(parseNumber("3.14", CultureInfo.CurrentCulture)).toBe(3.14);
		});
		test("parseNumber('#.#')", () => {
			expect(parseNumber("3.1", CultureInfo.CurrentCulture)).toBe(3.1);
		});
		test("parseNumber('#')", () => {
			expect(parseNumber("3", CultureInfo.CurrentCulture)).toBe(3);
		});
	});
});
