/* eslint-disable no-new */
import { Model } from "./model";
import { Entity, EntityConstructorForType } from "./entity";
import "./resource-en";
import { CultureInfo } from "./globalization";
import { updateArray } from "./observable-array";

let Types: { [name: string]: EntityConstructorForType<Entity> };

function resetModel() {
	Types = {};
	CultureInfo.setup();
	return new Model({
		$namespace: Types as any,
		$locale: "en",
		$culture: CultureInfo.CurrentCulture,
		Credits: {
			Movie: "Movie",
			CastSize: {
				type: Number,
				get: {
					dependsOn: "Movie.Cast",
					function() {
						return this.Movie.Cast.length;
					}
				}
			}
		},
		Movie: {
			Id: {
				identifier: true,
				type: String
			},
			Title: String,
			Director: {
				type: "Person",
				format: "[FullName] [Salary]"
			},
			ReleaseDate: Date,
			Genres: "String[]",
			Credits: {
				type: "Credits"
			},
			Cast: "Person[]"
		},
		Person: {
			Id: {
				identifier: true,
				type: String
			},
			FirstName: String,
			LastName: String,
			FullName: {
				type: String,
				get() {
					return `${this.FirstName} ${this.LastName}`;
				}
			},
			Species: {
				constant: "Homo sapiens",
				type: String
			},
			Movie: "Movie",
			Salary: {
				default: null,
				type: Number,
				format: "C"
			}
		}
	});
}

const Alien = {
	Cast: [],
   	Credits: null,
	Director: {
		FirstName: "Ridley",
		Id: null,
		LastName: "Scott",
		Movie: null,
		Salary: null
	},
	Genres: [
		"science fiction",
		"action"
	],
	Id: null,
	ReleaseDate: null,
	Title: "Alien"
};

describe("Entity", () => {
	let model: Model;
	beforeEach(() => {
		model = resetModel();
	});

	describe("construction", () => {
		it("can be extended and constructed", () => {
			const movie = new Types.Movie();

			expect(movie).toBeInstanceOf(Entity);

			expect(movie).toHaveProperty("Title");
			expect(movie).toHaveProperty("Director");
			expect(movie).toHaveProperty("ReleaseDate");
			expect(movie).toHaveProperty("Genres");
		});

		it("can be constructed with provided state", () => {
			const movie = new Types.Movie(Alien) as any;

			expect(movie.Title).toBe(Alien.Title);
			expect(movie.Director.FirstName).toBe(Alien.Director.FirstName);
			expect(movie.Director.LastName).toBe(Alien.Director.LastName);
			// call slice to get rid of observable overrides
			expect(movie.Genres.slice()).toEqual(Alien.Genres);
		});

		it("can be constructed with prebuilt child entities", () => {
			const state = Object.assign({}, Alien, {
				// Instead of a literal object representing the desired state, pass a Person instance
				Director: new Types.Person(Alien.Director)
			});
			const movie = new Types.Movie(state);

			expect(movie.serialize()).toEqual(Alien);
		});

		it("cannot initialize calculated properties", () => {
			const person = new Types.Person({ FirstName: "John", LastName: "Doe", FullName: "Jane Doe" });
			expect(person.FullName).toBe("John Doe");
		});

		it("cannot initialize constant properties", () => {
			const person = new Types.Person({ Species: "Homo erectus" });
			expect(person.Species).toBe("Homo sapiens");
		});
	});

	describe("set", () => {
		it("can be used to update an entity", () => {
			const movie = new Types.Movie();
			movie.set(Alien);
			expect(movie.serialize()).toEqual(Alien);
		});

		it("cannot be used to set calculated properties", () => {
			const person = new Types.Person({ FirstName: "John", LastName: "Doe" });
			person.set({ FullName: "Full Name" });
			expect(person.FullName).toBe("John Doe");
		});

		it("cannot be used to set constant properties", () => {
			const person = new Types.Person();
			person.set({ Species: "Homo erectus" });
			expect(person.Species).toBe("Homo sapiens");
		});
	});

	describe("events", () => {
		describe("property change is not raised when initializing existing entity", () => {
			test("value property", async () => {
				const changed = jest.fn();
				Types.Person.meta.getProperty("FirstName").changed.subscribe(changed);
				Types.Person.meta.getProperty("LastName").changed.subscribe(changed);
				await Types.Person.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });

				expect(changed).not.toBeCalled();
			});

			test("value list property", async () => {
				const changed = jest.fn();
				Types.Movie.meta.getProperty("Genres").changed.subscribe(changed);
				await Types.Movie.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });

				expect(changed).not.toBeCalled();
			});
		});

		describe("property change is raised when initializing new entity", () => {
			test("value property", () => {
				const changed = jest.fn();
				Types.Person.meta.getProperty("FirstName").changed.subscribe(changed);
				Types.Person.meta.getProperty("LastName").changed.subscribe(changed);
				new Types.Person(Alien.Director);

				expect(changed).toBeCalledTimes(2);
			});

			test("value list property", () => {
				const changed = jest.fn();
				Types.Movie.meta.getProperty("Genres").changed.subscribe(changed);
				new Types.Movie(Alien);

				expect(changed).toBeCalled();
			});
		});
	});

	it("can be serialized", () => {
		const movie = new Types.Movie(Alien);

		expect(movie.serialize()).toEqual(Alien);
	});

	describe("default value", () => {
		const _default = {
			Title: "Untitled",
			Director: { FirstName: "John", LastName: "Doe" },
			Genres: [] as string[]
		};

		describe("static", () => {
			beforeAll(() => {
				Types.Person.meta.extend({
					FirstName: { default: _default.Director.FirstName },
					LastName: { default: _default.Director.LastName }
				});

				Types.Movie.meta.extend({
					Title: { default: _default.Title }
				});
			});

			it("does not overwrite provided state of new entity", () => {
				const movie = new Types.Movie(Alien);

				expect(movie.serialize()).toEqual(Alien);
			});

			it("does not overwrite provided state of existing entity", async () => {
				const state = { Id: "1", ...Alien };
				const movie = await Types.Movie.meta.create(state);

				expect(movie.serialize()).toEqual(state);
			});
		});

		describe("rule", () => {
			let calculated = jest.fn();
			beforeEach(() => {
				calculated.mockReset();
			});

			beforeAll(() => {
				Types.Person.meta.extend({
					FirstName: { default: () => _default.Director.FirstName },
					LastName: { default: () => _default.Director.LastName }
				});

				Types.Movie.meta.extend({
					Title: { default: () => _default.Title },
					Director: { default: () => new Types.Person() }
				});
			});

			it("does not overwrite initial state of new entity", () => {
				const movie = new Types.Movie(Alien);

				expect(movie.serialize()).toEqual(Alien);
			});

			it("does not overwrite initial state of existing entity", async () => {
				const state = { Id: "1", ...Alien };
				const movie = await Types.Movie.meta.create(state);

				expect(movie.serialize()).toEqual(state);
			});
		});
	});

	describe("list", () => {
		it("can add/remove primitive items", () => {
			const movie = new Types.Movie(Alien) as any;
			const horror = "horror";

			movie.Genres.push(horror);
			expect(movie.Genres.slice()).toEqual([...Alien.Genres, horror]);

			movie.Genres.pop();
			expect(movie.Genres.slice()).toEqual(Alien.Genres);
		});

		it("can add/remove entity items", () => {
			const movie = new Types.Movie(Alien) as any;
			const sigourney = new Types.Person({ FirstName: "Sigourney", LastName: "Weaver" });
			const john = new Types.Person({ FirstName: "John", LastName: "Hurt" });

			movie.Cast.push(sigourney);
			expect(movie.Cast[0]).toBe(sigourney);

			movie.Cast.push(john);
			expect(movie.Cast[1]).toBe(john);

			movie.Cast.pop();
			expect(movie.Cast.slice()).toEqual([sigourney]);
		});

		it("should not publish property change event for no list changes", () => {
			const movie = new Types.Movie(Alien);
			const changehandler = jest.fn();
			movie.meta.type.getProperty("Cast").changed.subscribe(changehandler);
			movie["Cast"].batchUpdate(() => updateArray(movie["Cast"], []));
			expect(changehandler).not.toBeCalled();
		});
	});

	describe("formatting", () => {
		it("supports tokens", () => {
			const movie = new Types.Movie(Alien);
			expect(movie.toString("[Title]")).toBe("Alien");
		});

		it("supports tokens with nested paths", () => {
			const movie = new Types.Movie(Alien);
			expect(movie.toString("[Title] - [Director.FirstName] [Director.LastName]")).toBe("Alien - Ridley Scott");
		});

		it("supports token value post processing", () => {
			const movie = new Types.Movie(Alien);
			expect(movie.toString("[Title] - [Director.FirstName] [Director.LastName]", v => `'${v}'`)).toBe("'Alien' - 'Ridley' 'Scott'");
		});

		it("uses format of properties targeted by tokens", () => {
			const movie = new Types.Movie(Alien);
			movie.Director.Salary = 100000;
			expect(movie.toString("[Director]")).toBe("Ridley Scott $100,000.00");
		});
	});
});
