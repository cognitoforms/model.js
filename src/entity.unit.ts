/* eslint-disable no-new */
import { Model, ModelNamespace, ModelOfType, createModel } from "./model";
import { Entity, EntityArgsOfType, EntityOfType, isEntity } from "./entity";
import "./resource-en";
import { CultureInfo } from "./globalization";
import { ArrayChangeType, updateArray } from "./observable-array";
import { createEventObject } from "./events";
import { Property$pendingInit } from "./property";

type Namespace = {
	Credits: Credits,
	LineItem: LineItem,
	Budget: Budget,
	Address: Address,
	Movie: Movie,
	Person: Person
};

type Credits = {
	Movie: Movie;
	CastSize: number;
};

type LineItem = {
	Label: string;
	Cost: number;
};

type Budget = {
	LineItems: LineItem[]
};

type Address = {
	City: string;
	State: string;
};

type Movie = {
	Id: string;
	Title: string;
	Director: Person;
	ReleaseDate: Date,
	ReleaseYear: number;
	Genres: string[];
	Credits: Credits;
	Cast: Person[];
	Budget: Budget;
};

type Person = {
	Id: string;
	FirstName: string;
	LastName: string;
	readonly FullName: string;
	readonly Species: "Homo sapiens";
	Movie: Movie;
	Address: Address;
	Salary: number;
}

function resetModel<TTypes>(ns?: any) {
	CultureInfo.setup();
	return createModel<Namespace>({
		$namespace: ns,
		$locale: "en",
		$culture: CultureInfo.CurrentCulture as any,
		Credits: {
			Movie: "Movie",
			CastSize: {
				type: Number,
				get: {
					dependsOn: "Movie.Cast",
					function() {
						return this.Movie ? this.Movie.Cast.length : 0;
					}
				}
			}
		},
		LineItem: {
			Label: String,
			Cost: Number
		},
		Budget: {
			LineItems: "LineItem[]"
		},
		Address: {
			City: String,
			State: String
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
			ReleaseYear: {
				type: Number,
				default() {
					return this.ReleaseDate ? this.ReleaseDate.getFullYear() : null;
				},
				required() {
					return this.ReleaseYear != null && !isNaN(this.ReleaseYear);
				},
				dependsOn: "ReleaseDate"
			},
			Genres: "String[]",
			Credits: {
				type: "Credits"
			},
			Cast: "Person[]",
			Budget: "Budget"
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
			Address: "Address",
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
	Budget: null,
	Director: {
		FirstName: "Ridley",
		Id: null,
		LastName: "Scott",
		Movie: null,
		Salary: null,
		Address: null
	},
	Genres: [
		"science fiction",
		"action"
	],
	Id: null,
	ReleaseDate: null,
	ReleaseYear: null,
	Title: "Alien"
};

describe("Entity", () => {
	let model: ModelOfType<Namespace>;
	let Types: ModelNamespace<Namespace>;
	beforeEach(async () => {
		model = await resetModel({});
		Types = model.$namespace!;
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
			const movie = new Types.Movie(Alien);

			expect(movie.Title).toBe(Alien.Title);
			expect(movie.Director!.FirstName).toBe(Alien.Director.FirstName);
			expect(movie.Director!.LastName).toBe(Alien.Director.LastName);
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
			const person = new Types.Person({ FirstName: "John", LastName: "Doe", FullName: "Jane Doe" } as any);
			expect(person.FullName).toBe("John Doe");
		});

		it("cannot initialize constant properties", () => {
			const person = new Types.Person({ Species: "Homo erectus" });
			expect(person.Species).toBe("Homo sapiens");
		});

		it("cannot initialize reference properties to undefined", () => {
			const person = Types.Person.meta.createSync({ Id: "1", Movie: undefined });
			const movieProp = Types.Person.meta.getProperty("Movie");
			expect(Property$pendingInit(person, movieProp)).toBe(true);
			expect(person.Movie).toBe(null);
			expect(person.serialize()).toEqual({ Address: null, FirstName: null, Id: "1", LastName: null, Movie: null, Salary: null });
		});

		it("can initialize reference properties to null", () => {
			const person = Types.Person.meta.createSync({ Id: "1", Movie: null });
			const movieProp = Types.Person.meta.getProperty("Movie");
			expect(Property$pendingInit(person, movieProp)).toBe(false);
			expect(person.Movie).toBe(null);
			expect(person.serialize()).toEqual({ Address: null, FirstName: null, Id: "1", LastName: null, Movie: null, Salary: null });
		});

		it("invalid data for reference properties is ignored", () => {
			const person = Types.Person.meta.createSync({ Id: "1", Movie: "Toy Story" });
			const movieProp = Types.Person.meta.getProperty("Movie");
			expect(Property$pendingInit(person, movieProp)).toBe(true);
			expect(person.Movie).toBe(null);
			expect(person.serialize()).toEqual({ Address: null, FirstName: null, Id: "1", LastName: null, Movie: null, Salary: null });
		});

		it("provides a way to wait for initialization to complete", async () => {
			const Budget1 = { LineItems: [{ Label: "L1", Cost: 1000000 }] };
			model.serializer.registerValueResolver((entity, prop, value) => {
				if (prop.name === "Budget" && value === "BUDGET_1")
					return Promise.resolve(Budget1);
			});
			// TODO: Allow values of any type since async initializers could expect any type
			var args: EntityArgsOfType<Movie> = { ...Alien };
			(args as any)["Budget"] = "BUDGET_1";
			const movie = new Types.Movie(args);
			const expected = { ...Alien, Budget: Budget1 };
			expect(movie.serialize()).not.toEqual(expected);
			await movie.initialized;
			expect(movie.serialize()).toEqual(expected);
		});
	});

	describe("update", () => {
		it("can be used to update an entity", () => {
			const movie = new Types.Movie();
			movie.update(Alien);
			expect(movie.serialize()).toEqual(Alien);
		});

		it("cannot be used to set calculated properties", () => {
			const person = new Types.Person({ FirstName: "John", LastName: "Doe" });
			person.update({ FullName: "Full Name" });
			expect(person.FullName).toBe("John Doe");
		});

		it("cannot be used to set constant properties", () => {
			const person = new Types.Person();
			person.update({ Species: "Homo erectus" });
			expect(person.Species).toBe("Homo sapiens");
		});

		it("cannot be used to set a value deserialized to undefined", () => {
			const person = new Types.Person(Alien.Director);
			const movieBeforeSet = person.Movie;
			jest.spyOn(person.serializer, "deserialize").mockImplementation(() => undefined);
			person.update({ Movie: Alien });
			expect(person.Movie).toBe(movieBeforeSet);
		});

		it("cannot be used to set a value deserialized to undefined in a list", () => {
			const movie = new Types.Movie({ Cast: [{ FirstName: "John", LastName: "Doe" }] });
			const movieBeforeSet = movie.Cast;
			jest.spyOn(movie.serializer, "deserialize").mockImplementation(() => undefined);
			movie.update({ Cast: [{ FirstName: "Ridley", LastName: "Scott" }, { FirstName: "John", LastName: "Doe" }] });
			expect(movie.Cast).toBe(movieBeforeSet);
		});

		it("allows waiting for asynchronous values to be set", async () => {
			const Budget1 = { LineItems: [{ Label: "L1", Cost: 1000000 }] };

			model.serializer.registerValueResolver((entity, prop, value) => {
				if (prop.name === "Budget" && value === "BUDGET_1")
					return Promise.resolve(Budget1);
			});

			const movie = new Types.Movie(Alien);

			// NOTE: as Entity is necessary to avoid TS complaining about "Budget"
			const updateTask = (movie as Entity).update({ Title: "Alien 2", Budget: "BUDGET_1" });

			expect(movie.Title).toBe("Alien 2");
			expect(movie.Budget).toBeNull();

			await updateTask;

			expect(movie.Budget).not.toBeNull();
			expect(movie.Budget!.serialize()).toEqual(Budget1);
		});

		it("asynchronous property is initialized before initExisting event published ", async () => {
			const Budget1 = { LineItems: [{ Label: "L1", Cost: 1000000 }] };

			model.serializer.registerValueResolver((entity, prop, value) => {
				if (prop.name === "Budget" && value === "BUDGET_1")
					return Promise.resolve(Budget1);
			});

			Types.Movie.meta.initExisting.subscribe(({ entity: movie }) => {
				expect(movie.Budget!.serialize()).toEqual(Budget1);
			});

			await Types.Movie.meta.create({ ...Alien, Id: "1", Budget: "BUDGET_1" });
		});

		it("should support circular async value resolution", async () => {
			const model = new Model({
				Entity: {
					Id: { identifier: true, type: String },
					Name: String,
					Sibling: "Entity"
				}
			});

			const entities = {
				a: {
					Id: "a",
					Name: "Entity A",
					Sibling: "b"
				},
				b: {
					Id: "b",
					Name: "Entity B",
					Sibling: "a"
				}
			};

			const siblingResolver = (instance, prop, value) => {
				if (prop.name === "Sibling")
					return new Promise(resolve => setTimeout(() => resolve(entities[value]), 10));
			};

			model.serializer.registerValueResolver(siblingResolver);

			let entity = await model.types.Entity.create(entities.a);
			await entity.update(entities.a);
			expect((entity as any).Sibling.Sibling).toBe(entity);
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
				await Types.Movie.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott", Genres: ["fantasy"] });

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

		describe("entity change event", () => {
			test("is called when value property is changed", async () => {
				const changed = jest.fn();
				const instance = await Types.Person.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });
				const property = Types.Person.meta.getProperty("FirstName");
				instance.changed.subscribe(changed);
				property.value(instance, "Joe");
				expect(changed).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					oldValue: "Ridley",
					newValue: "Joe"
				}));
			});

			test("is called with additional arguments when specified for a property change", async () => {
				const changed = jest.fn();
				const instance = await Types.Person.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });
				const property = Types.Person.meta.getProperty("FirstName");
				instance.changed.subscribe(changed);
				property.value(instance, "Joe", { test: 42 });
				expect(changed).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					oldValue: "Ridley",
					newValue: "Joe",
					test: 42
				}));
			});

			test("is called when value list property is changed", async () => {
				const changed = jest.fn();
				const instance = await Types.Movie.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });
				const property = Types.Movie.meta.getProperty("Genres");
				const genres = instance.Genres;
				instance.changed.subscribe(changed);
				property.value(instance, genres.concat(["fantasy"]));
				expect(changed).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					newValue: expect.arrayContaining(["fantasy"]),
					collectionChanged: true,
					changes: expect.arrayContaining([
						{
							type: ArrayChangeType.add,
							startIndex: 0,
							endIndex: 0,
							items: expect.arrayContaining(["fantasy"])
						}
					])
				}));
			});

			test("is called with additional arguments when specified for a list change", async () => {
				const changed = jest.fn();
				const instance = await Types.Movie.meta.create({ Id: "1", FirstName: "Ridley", LastName: "Scott" });
				const property = Types.Movie.meta.getProperty("Genres");
				const genres = (instance as any).Genres;
				instance.changed.subscribe(changed);
				property.value(instance, genres.concat(["fantasy"]), { test: 42 });
				expect(changed).toBeCalledWith(createEventObject({
					entity: instance,
					property,
					newValue: expect.arrayContaining(["fantasy"]),
					collectionChanged: true,
					changes: expect.arrayContaining([
						{
							type: ArrayChangeType.add,
							startIndex: 0,
							endIndex: 0,
							items: expect.arrayContaining(["fantasy"])
						}
					]),
					test: 42
				}));
			});
		});
	});

	describe("serialize", () => {
		it("can be serialized", () => {
			const movie = new Types.Movie(Alien);

			expect(movie.serialize()).toEqual(Alien);
		});

		it("can be serialized with aliases", () => {
			const movie = new Types.Movie(Alien);
			const aliases = [
				{ type: "Movie", alias: "T", propertyName: "Title" },
				{ type: "Movie", alias: "RY", propertyName: "ReleaseYear" },
				{ type: "Movie", alias: "RD", propertyName: "ReleaseDate" },
				{ type: "Movie", alias: "D", propertyName: "Director" },
				{ type: "Movie", alias: "G", propertyName: "Genres" },
				{ type: "Movie", alias: "A", propertyName: "Actors" },
				{ type: "Movie", alias: "B", propertyName: "Budget" },
				{ type: "Movie", alias: "I", propertyName: "Id" }
			];
			aliases.forEach(element => {
				movie.serializer.registerPropertyAlias(element.type, element.alias, element.propertyName);
			});
			const expectedAlien = {
				Cast: [],
				Credits: null,
				B: null,
				D: {
					FirstName: "Ridley",
					Id: null,
					LastName: "Scott",
					Movie: null,
					Salary: null,
					Address: null
				},
				G: [
					"science fiction",
					"action"
				],
				I: null,
				RD: null,
				RY: null,
				T: "Alien"
			};
			expect(movie.serialize({ useAliases: true })).toEqual(expectedAlien);
		});

		it("default values are run when serializing", async () => {
			const defaultModel = await createModel<{
				Test: {
					A: string;
				}
			}>({
				Test: {
					A: {
						type: String,
						default: "a default"
					}
				}
			});

			const instance = new defaultModel.Test();
			expect(instance.serialize()).toEqual({ "A": "a default" });
		});
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
					FirstName: { type: String, default: _default.Director.FirstName },
					LastName: { type: String, default: _default.Director.LastName }
				});

				Types.Movie.meta.extend({
					Title: { type: String, default: _default.Title }
				});
			});

			it("does not overwrite provided state of new entity", () => {
				const movie = new Types.Movie(Alien);

				expect(movie.serialize()).toEqual(Alien);
			});

			it("does not overwrite provided state of existing entity", async () => {
				const state = { ...Alien, Id: "1" };
				const movie = await Types.Movie.meta.create(state);

				expect(movie.serialize()).toEqual(state);
			});
		});

		describe("rule", () => {
			let calculated = jest.fn();
			beforeEach(() => {
				calculated.mockReset();
			});

			beforeEach(() => {
				Types.Person.meta.extend({
					FirstName: { type: String, default: () => _default.Director.FirstName },
					LastName: { type: String, default: () => _default.Director.LastName }
				});

				Types.Movie.meta.extend({
					Title: { type: String, default: () => _default.Title },
					Director: { type: "Person", default: () => new Types.Person() }
				});
			});

			it("does not overwrite initial state of new entity", () => {
				const movie = new Types.Movie(Alien);

				expect(movie.serialize()).toEqual(Alien);
			});

			it("does not overwrite initial state of existing entity", async () => {
				const state = { ...Alien, Id: "1" };
				const movie = await Types.Movie.meta.create(state);

				expect(movie.serialize()).toEqual(state);
			});

			it("sets value correctly when validation rule also present", async() => {
				const movie = await Types.Movie.meta.create({ ReleaseDate: new Date() });
				expect(movie.ReleaseYear).toBe(new Date().getFullYear());
			});
		});
	});

	describe("list", () => {
		type Person = {
			Id: string;
			Skills: Skill[];
		};

		type Skill = {
			Name: string;
			Proficiency: number;
		};

		type PersonWithSkillsNamespace = {
			Person: Person;
			Skill: Skill;
		};

		let PersonWithSkillsTypes: ModelNamespace<PersonWithSkillsNamespace>;
		beforeEach(async () => {
			PersonWithSkillsTypes = {} as any;
			await createModel<PersonWithSkillsNamespace>({
				$namespace: PersonWithSkillsTypes,
				Skill: {
					Name: String,
					Proficiency: {
						default() { return null; },
						type: Number
					}
				},
				Person: {
					Id: { identifier: true, type: String },
					Skills: {
						type: "Skill[]",
						default() {
							return [{
								Id: 1,
								Name: "Climbing",
								Proficiency: 4
							},
							{
								Id: 2,
								Name: "Eating",
								Proficiency: 4
							}];
						}
					}
				}
			});
		});

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

		it("can set an empty list", async () => {
			const instance = await PersonWithSkillsTypes.Person.meta.create({}) as any;
			expect(instance.Skills.length).toBe(2);
			instance.update({ Skills: [] });
			expect(instance.Skills.length).toBe(0);
		});

		it("Updating a list with an array with less items does not leave extra items in the array", async () => {
			const instance = await PersonWithSkillsTypes.Person.meta.create({}) as any;
			const skillInstance = await PersonWithSkillsTypes.Skill.meta.create({ Name: "Surfing" }) as any;
			expect(instance.Skills.length).toBe(2);
			instance.update({ Skills: [skillInstance] }, null, true);
			expect(instance.Skills.length).toBe(1);
		});

		it("runs default rule for list property for new instance with no property value in initial state", async () => {
			const instance = await PersonWithSkillsTypes.Person.meta.create({}) as any;
			expect(instance.Skills.length).toBe(2);
		});

		it("does not runs default rule for list property for new object with empty list in initial state", async () => {
			const instance = await PersonWithSkillsTypes.Person.meta.create({ Skills: [] }) as any;
			expect(instance.Skills.length).toBe(0);
		});

		it("runs default rule for list property for existing object with no property value in initial state", async () => {
			const instance = await PersonWithSkillsTypes.Person.meta.create({ Id: "test" }) as any;
			expect(instance.Skills.length).toBe(2);
		});

		it("triggers property change when default calculation runs for list", async () => {
			const skillsChanged = jest.fn();
			PersonWithSkillsTypes.Person.meta.getProperty("Skills").changed.subscribe(skillsChanged);

			const instance = await PersonWithSkillsTypes.Person.meta.create({}) as any;
			expect(instance.Skills.length).toBe(2);

			expect(skillsChanged).toBeCalledTimes(1);
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
			movie.Director!.Salary = 100000;
			expect(movie.toString("[Director]")).toBe("Ridley Scott $100,000.00");
		});
	});

	describe("markPersisted()", () => {
		it("assigning identifier property of entity calls markPersisted", () => {
			const movie = new Types.Movie(Alien);
			const markPersisted = jest.spyOn(movie, "markPersisted");
			movie.Id = "1";
			expect(markPersisted).toBeCalledTimes(1);
		});

		it("nested entity is not considered new when assigned alongside identifier property", () => {
			const movie = new Types.Movie(Alien);
			movie.Director!.update({
				Id: "1",
				Address: { City: "Orlando", State: "Florida" }
			});

			expect(movie.Director!.meta.isNew).toBeFalsy();
			expect(movie.Director!.Address!.meta.isNew).toBeFalsy();
		});

		it("asynchronously resolved nested entity is not considered new when assigned alongside identifier property", async () => {
			model.serializer.registerValueResolver((instance, prop, value) => {
				if (value === "test_async_address")
					return Promise.resolve({ City: "Orlando", State: "Florida" });
			});
			const movie = new Types.Movie(Alien);

			// NOTE: as Entity is necessary to avoid TS complaining about "Address"
			await (movie.Director as Entity).update({
				Id: "1",
				Address: "test_async_address"
			});

			expect(movie.Director!.meta.isNew).toBeFalsy();
			expect(movie.Director!.Address!.meta.isNew).toBeFalsy();
		});

		it("does not affect non-identifying entity", () => {
			const budget = new Types.Budget();	// Budget type has no identifier property
			budget.markPersisted();
			expect(budget.meta.isNew).toBeTruthy();
		});

		describe("identifying entity", () => {
			let movie: EntityOfType<Movie>;

			beforeEach(() => {
				movie = new Types.Movie(Alien);	// Movie type has an identifier property
				movie.update({
					Budget: {
						LineItems: [
							{ Label: "Item 1", Cost: 100 }
						]
					}
				});
			});

			describe("with no id", () => {
				it("does nothing", () => {
					movie.markPersisted();
					expect(movie.meta.isNew).toBeTruthy();
				});

				it("does not affect nested entities", () => {
					movie.markPersisted();

					expect(movie.Budget!.meta.isNew).toBeTruthy();
					for (const lineItem of movie.Budget!.LineItems)
						expect(lineItem.meta.isNew).toBeTruthy();
				});
			});

			describe("with id", () => {
				beforeEach(() => {
					movie.Id = "1";
				});

				it("marks nested, non-identifying entities as not new", () => {
					movie.markPersisted();

					expect(movie.Budget!.meta.isNew).toBeFalsy();
					for (const lineItem of movie.Budget!.LineItems)
						expect(lineItem.meta.isNew).toBeFalsy();
				});

				it("handles circular references", () => {
					movie.update({ Credits: { Movie: movie } });

					movie.markPersisted();

					expect(movie.Credits!.meta.isNew).toBeFalsy();
				});

				it("does not affect nested, sovereign entities", () => {
					movie.markPersisted();
					expect(movie.Director!.meta.isNew).toBeTruthy();

					movie.Director!.update({ Id: "1" });

					// Assigning the Director's id will mark it as not new
					expect(movie.Director!.meta.isNew).toBeFalsy();

					movie.Director!.update({ Address: { City: "Orlando", State: "Florida" } });

					movie.markPersisted();

					// But the Director's Address (an "owned" entity) should not be marked persisted as a result of persisting the Movie
					expect(movie.Director!.Address!.meta.isNew).toBeTruthy();
				});
			});
		});
	});

	describe("isEntity", () => {
		it("returns true if the argument is an instance of an entity, otherwise false", () => {
			// When given an entity, `isEntity` will return true and "cast" the object to type Entity
			const person: any = new Types.Person({ FirstName: "John", LastName: "Doe", FullName: "Jane Doe" });
			if (isEntity(person))
				expect(person.meta.type.fullName).toBe("Person");
			else
				expect(isEntity(person)).toBe(true);

			expect(isEntity("foo")).toBeFalsy();
			expect(isEntity(42)).toBeFalsy();
			expect(isEntity({})).toBeFalsy();
			expect(isEntity(person.meta)).toBeFalsy();
			expect(isEntity(person.meta.type)).toBeFalsy();
			expect(isEntity(person.meta.type.jstype)).toBeFalsy();
			expect(isEntity(model)).toBeFalsy();
		});
	});
});
