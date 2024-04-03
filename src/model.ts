import { Event, EventSubscriber } from "./events";
import { replaceTokens, ObjectLookup } from "./helpers";
import { EntityRegisteredEventArgs, Entity, EntityChangeEventArgs, EntityConstructorForType } from "./entity";
import { Type, PropertyType, isEntityType, ValueConstructor, TypeOptions, TypeOfType } from "./type";
import { Format, createFormat } from "./format";
import { EntitySerializer } from "./entity-serializer";
import { LocalizedResourcesMap, setDefaultLocale, defineResources, getResource, resourceExists } from "./resource";
import { CultureInfo, formatNumber, parseNumber, formatDate, parseDate, expandDateFormat, getNumberStyle } from "./globalization";
import { EventScope, EventScopeSettings, EVENT_SCOPE_DEFAULT_SETTINGS } from "./event-scope";

const valueTypes: { [name: string]: ValueConstructor } = { string: String, number: Number, date: Date, boolean: Boolean };

export class Model {
	readonly types: { [name: string]: Type };

	readonly settings: ModelSettings;

	readonly $namespace: ModelNamespace<any> | null;
	readonly $locale: string;
	readonly $resources: LocalizedResourcesMap;
	readonly $culture: CultureInfo;

	readonly entityRegistered: EventSubscriber<Model, EntityRegisteredEventArgs>;
	readonly afterPropertySet: EventSubscriber<Entity, EntityChangeEventArgs>;
	readonly listChanged: EventSubscriber<Entity, EntityChangeEventArgs>;
	readonly eventScope: EventScope;

	private _readyCallbacks: (() => void)[];
	private _readyProcessing = false;
	private readonly _formats: { [name: string]: { [name: string]: Format<ValueConstructor> } };

	readonly serializer = new EntitySerializer();

	constructor(options?: ModelOptions<any>, config?: ModelConfiguration) {
		this.types = {};
		this.settings = new ModelSettings(config);
		this.entityRegistered = new Event<Model, EntityRegisteredEventArgs>();
		this.afterPropertySet = new Event<Entity, EntityChangeEventArgs>();
		this.listChanged = new Event<Entity, EntityChangeEventArgs>();
		this.eventScope = EventScope.create(this.settings.eventScopeSettings);

		Object.defineProperty(this, "_formats", { enumerable: false, configurable: false, writable: true, value: {} });

		if (options) {
			this.extend(options);
		}
	}

	static create<TTypes>(options?: ModelTypeOptions<TTypes> & Required<ModelNamespaceOption<TTypes>> & ModelLocalizationOptions, config?: ModelConfiguration): Promise<ModelOfType<TTypes> & ModelWithNamespace<TTypes>>;
	static create<TTypes>(options?: ModelTypeOptions<TTypes> & ModelLocalizationOptions, config?: ModelConfiguration): Promise<ModelOfType<TTypes> & ModelNamespace<TTypes>>;
	static create<TTypes>(options?: ModelOptions<TTypes>, config?: ModelConfiguration): Promise<ModelOfType<TTypes>> {
		return new Promise((resolve) => {
			const model = new Model(options, config);
			model.ready(() => {
				resolve(model as ModelOfType<TTypes>);
			});
		});
	}

	/**
	 * Sets the default locale to use when a model's locale is not explicitly set
	 * @param locale The default locale
	 */
	static setDefaultLocale(locale: string): void {
		setDefaultLocale(locale);
	}

	/**
	 * Defines global resource messages for the given locale
	 * @param locale The locale to set messages for
	 * @param resources The resources messages
	 */
	static defineResources(locale: string, resources: ObjectLookup<string>): void {
		defineResources(locale, resources);
	}

	/**
	 * Gets the resource with the specified name
	 * @param name The resource name/key
	 * @param locale The locale of the resource
	 * @param params The parameters to use for string format substitution
	 */
	static getResource(name: string, locale?: string): string;
	static getResource(name: string, params?: ObjectLookup<string>): string;
	static getResource(name: string, locale?: string, params?: ObjectLookup<string>): string;
	static getResource(name: string, arg2?: string | ObjectLookup<string>, arg3?: ObjectLookup<string>): string {
		let locale: string;
		let params: ObjectLookup<string>;
		if (arguments.length === 2) {
			if (typeof arg2 === "string") {
				locale = arg2;
				params = null;
			}
			else if (typeof arg2 === "object") {
				locale = null;
				params = arg2;
			}
		}
		else if (arguments.length >= 3) {
			locale = arg2 as string;
			params = arg3 as ObjectLookup<string>;
		}

		let resource = getResource(name, locale);
		if (params)
			return replaceTokens(resource, params);
		return resource;
	}

	/**
	 * Gets the resource with the specified name
	 * @param name The resource name/key
	 * @param params The parameters to use for string format substitution
	 */
	getResource(name: string, params: ObjectLookup<string> = null): string {
		let resource = getResource(name, this.$resources, this.$locale);
		if (params)
			return replaceTokens(resource, params);
		return resource;
	}

	resourceExists(name: string) {
		return resourceExists(name, this.$resources, this.$locale);
	}

	/**
	 * Formats a date as text using the given format string
	 * @param date The date to format
	 * @param format The format specifier
	 */
	formatDate(date: Date, format: string): string {
		return formatDate(date, format, this.$culture);
	}

	/**
	 * Parses a date from text
	 * @param text The text to parse
	 */
	parseDate(text: string, formats?: string[]): Date {
		return parseDate(text, this.$culture, formats);
	}

	/**
	 * Expands a date/time format string, which may be a predefined short format, into the equivalent full format strin
	 * @param format The format string
	 */
	expandDateFormat(format: string): string {
		return expandDateFormat(this.$culture.dateTimeFormat, format);
	}

	/**
	 * Formats a number as text using the given format string
	 * @param number The number to format
	 * @param format The format specifier
	 */
	formatNumber(number: number, format: string): string {
		return formatNumber(number, format, this.$culture);
	}

	/**
	 * Parses a number from text
	 * @param text The text to parse
	 */
	parseNumber(text: string, format?: string): number {
		return parseNumber(text, getNumberStyle(format), this.$culture);
	}

	/**
	 * Extends the model with the specified type information.
	 * @param options The set of model types to add and/or extend.
	 */
	extend(options: ModelOptions<any>): void {
		// Use prepare() to defer property path resolution while the model is being extended
		this.prepare(() => {
			// Namespace
			if (options.$namespace) {
				// TODO: Guard against namespace being set after types have been created
				let $namespace = options.$namespace as object;
				if (!this.$namespace) {
					Object.defineProperty(this, "$namespace", { configurable: false, enumerable: true, value: $namespace, writable: false });
				}
				else if ($namespace !== this.$namespace) {
					throw new Error("Cannot redefine namespace for model.");
				}
			}

			// Locale
			if (options.$locale && typeof options.$locale === "string") {
				// TODO: Guard against locale being set after types have been created
				let $locale = options.$locale as string;
				if (!this.$locale) {
					Object.defineProperty(this, "$locale", { configurable: false, enumerable: true, value: $locale, writable: false });
				}
				else if ($locale !== this.$locale) {
					throw new Error("Cannot redefine locale for model.");
				}
			}

			// Resources
			if (options.$resources && typeof options.$resources === "object") {
				// TODO: Guard against resources being set after types have been created
				let $resources = (options.$resources as any) as ObjectLookup<ObjectLookup<string>>;
				if (!this.$resources) {
					Object.defineProperty(this, "$resources", { configurable: false, enumerable: true, value: $resources, writable: false });
				}
				else if ($resources !== this.$resources) {
					throw new Error("Cannot redefine resources for model.");
				}
			}

			// Culture
			if (options.$culture) {
				let $culture: CultureInfo;
				// TODO: Guard against culture being set after types have been created
				if (typeof options.$culture === "object") {
					$culture = options.$culture;
				}
				else if (typeof options.$culture === "string") {
					CultureInfo.setup();
					if (CultureInfo.CurrentCulture.name === options.$culture) {
						$culture = CultureInfo.CurrentCulture;
					}
					if (!$culture) {
						throw new Error("Could not find culture '" + options.$culture + "'.");
					}
				}
				if ($culture) {
					if (!this.$culture) {
						Object.defineProperty(this, "$culture", { configurable: false, enumerable: true, value: $culture, writable: false });
					}
					else if ($culture !== this.$culture) {
						throw new Error("Cannot redefine culture for model.");
					}
				}
			}

			let typesToCreate = Object.keys(options).filter(typeName => !typeName.startsWith("$"));

			let typesToInitialize: string[] = [];

			// Create New Types
			while (typesToCreate.length > 0) {
				let typeName = typesToCreate.splice(0, 1)[0];

				for (let typeNameIdx = -1, pos = typeName.length - 1, i = typeName.lastIndexOf(".", pos); i > 0; pos = i - 1, i = typeName.lastIndexOf(".", pos)) {
					let typeNamespace = typeName.substring(0, i);
					let typeNamespaceIdx = typesToCreate.indexOf(typeNamespace);
					if (typeNamespaceIdx > typeNameIdx) {
						if (process.env.NODE_ENV === "development") {
							console.warn("Type '" + typeNamespace + "' should be created before type '" + typeName + "'.");
						}

						// Remove the current  type's "namespace" type and re-add the current type to the list
						typesToCreate.splice(typeNamespaceIdx, 1);
						typesToCreate.splice(0, 0, typeName);
						typeNameIdx++;

						// Resume the loop using the new namespace type (resetting index variables isn't necessary)
						typeName = typeNamespace;
					}
				}

				let typeOptions = options[typeName] as TypeOptions<Entity>;
				let type = this.types[typeName];

				typesToInitialize.push(typeName);

				if (!type) {
					let baseType: Type = null;
					if (typeOptions.$extends) {
						baseType = this.types[typeOptions.$extends];
						if (!baseType) {
							throw new Error("Base type '" + typeOptions.$extends + "' for type '" + typeName + "' wasn't found.");
						}
					}

					let format = typeOptions.$format;

					type = new Type(this, typeName, baseType, format);
					this.types[typeName] = type;
				}
			}

			// Extend Types
			for (let typeName of typesToInitialize) {
				let typeOptions = options[typeName] as TypeOptions<Entity>;
				this.types[typeName].extend(typeOptions);
			}
		});
	}

	/**
	 * Prepares the model by invoking and extension function, which tracking the model
	 * ready state to allow use of the @ready promise to defer property path resolution.
	 * @param extend The function extending the model
	 */
	prepare(extend: () => void): void {
		// Create a model initialization scope
		if (!this._readyCallbacks) {
			this._readyProcessing = false;
			// Create an array to track model initialization callbacks
			Object.defineProperty(this, "_readyCallbacks", { enumerable: false, configurable: true, writable: true, value: [] });

			// Extend the model
			extend();

			// Complete pending model initialization steps
			this._readyProcessing = true;
			for (const init of this._readyCallbacks)
				init();
			this._readyProcessing = false;
			delete this._readyCallbacks;
		}

		// Leverage the current model initialization scope
		else
			extend();
	}

	/**
	 * Execute a function when the model is ready.
	 * @param init The function to invoke when the model is ready.
	 * @param enqueueWhileProcessing Determines whether the callback should be added to the queue while the queue is being processed.
	 */
	ready(callback: () => void, { enqueueWhileProcessing = true }: { enqueueWhileProcessing?: boolean; } = {}): void {
		if (this._readyCallbacks && (!this._readyProcessing || enqueueWhileProcessing))
			this._readyCallbacks.push(callback);
		else
			callback();
	}

	/**
	 * Gets the format for the specified property type and format string.
	 * @param type The type the format is for
	 * @param format The format template or specifier
	 */
	getFormat<T>(type: PropertyType, format: string, formatEval?: (tokenValue: string) => string): Format<T> {
		// Return null if a format specifier was not provided
		if (!format) {
			return null;
		}

		// Get the format cache for the type
		let formats: { [name: string]: Format<any> };
		if (isEntityType(type)) {
			formats = type.meta._formats;
		}
		else {
			formats = this._formats[type.name];
			if (!formats)
				formats = this._formats[type.name] = {};
		}

		// First see if the requested format is cached
		let f = formats[format];
		if (f) {
			return f;
		}

		// Otherwise, create and cache the format
		if (isEntityType(type)) {
			return (formats[format] = Format.fromTemplate<unknown>(type.meta, format, formatEval)) as unknown as Format<T>;
		}
		else {
			// otherwise, call the format provider to create a new format
			return (formats[format] = createFormat(this, type, format));
		}
	}

	/**
	 * Gets the javascript property type with the specified name.
	 * @param type
	 */
	getJsType(type: string): PropertyType {
		let jstype = type.toLowerCase() === "object" ? Object : valueTypes[type.toLowerCase()];
		if (!jstype) {
			let modelType = this.types[type];
			return modelType ? modelType.jstype : null;
		}
		return jstype;
	}
}

export interface ModelOfType<TTypes> extends Model {
	readonly types: { [T in keyof TTypes]: TypeOfType<TTypes[T]> };
}

export interface ModelWithNamespace<TNamespace> extends Model {
	readonly $namespace: ModelNamespace<TNamespace>;
}

export interface ModelConstructor<TNamespace> {
	new(createOwnProperties?: boolean): ModelOfType<TNamespace>;
}

export type ModelTypeOptions<TTypes> = {
	/**
	 * Standard type options ($extends and $format), properties, and methods/rules
	 */
	[T in keyof TTypes]: (TypeOptions<TTypes[T]>) | string;
}

export type ModelLocalizationOptions = {
	/**
	 * The model's locale (English is assumed by default)
	 */
	$locale?: string;

	/**
	 * The model's resource objects
	 */
	$resources?: LocalizedResourcesMap;

	/**
	 * The model's culture
	 */
	$culture?: CultureInfo | string;
}

export type ModelNamespace<TTypes> = {
	[T in keyof TTypes]: EntityConstructorForType<TTypes[T]>;
}

export type ModelNamespaceOption<TTypes> = {
	/**
	 * The object to use as the namespace for model types
	 */
	$namespace?: ModelNamespace<TTypes>;
}

export type ModelOptions<TTypes> = ModelTypeOptions<TTypes> & ModelNamespaceOption<TTypes> & ModelLocalizationOptions;

export type ModelConfiguration = {

	/**
	 * Determines whether properties are created as "own" properties, or placed on the type's prototype.
	 */
	createOwnProperties?: boolean;

	/**
	 * Determines whether properties will have labels generated based on their name when a label is not provided.
	 */
	autogeneratePropertyLabels?: boolean;

	/**
	 * Determines whether the global/window object is mutated, for example to hold references to types.
	 */
	useGlobalObject?: boolean;

	/**
	 * Controls the maximum number of times that a child event scope can transfer events to its parent while the parent scope is exiting.
	 */
	maxExitingEventScopeTransferCount?: number;

	/**
	 * Controls the maximum depth that an event scope can reach.
	 */
	maxEventScopeDepth?: number;
}

export class ModelSettings {
	// There is a slight speed cost to creating own properties,
	// which may be noticeable with very large object counts.
	readonly createOwnProperties: boolean = false;

	readonly autogeneratePropertyLabels: boolean = true;

	// Don't pollute the window object by default
	readonly useGlobalObject: boolean = false;

	// Use sane defaults for event scope settings, i.e. "non-exiting" scope detection
	readonly eventScopeSettings: EventScopeSettings = EVENT_SCOPE_DEFAULT_SETTINGS;

	constructor(config?: ModelConfiguration) {
		this.createOwnProperties = config && !!config.createOwnProperties;

		if (config && config.autogeneratePropertyLabels === false)
			this.autogeneratePropertyLabels = false;

		this.useGlobalObject = config && !!config.useGlobalObject;
		this.eventScopeSettings = {
			maxExitingTransferCount: (config && typeof config.maxExitingEventScopeTransferCount === "number" ? config.maxExitingEventScopeTransferCount : null) || EVENT_SCOPE_DEFAULT_SETTINGS.maxExitingTransferCount,
			maxDepth: (config && typeof config.maxEventScopeDepth === "number" ? config.maxEventScopeDepth : null) || EVENT_SCOPE_DEFAULT_SETTINGS.maxDepth
		};
	}
}

// Normalize the provided value based on the format specifier
// so that it can be used appropriately for comparisons
export function normalize(val: Date, format: string) : Date;
export function normalize(val: Date, format: Format<any>) : Date;
export function normalize(val: any, format: Format<any> | string) : any {
	if (!val && val !== false)
		return val;

	if (val.constructor.name === "Date") {
		let dateFormat = typeof format === "string" ? format : format.specifier;
		if (dateFormat === "t") {
			// Set the date of the dateTime to January 1st, 1970
			const newDate = new Date(val.valueOf());
			newDate.setFullYear(1970);
			newDate.setMonth(0);
			newDate.setDate(1);
			return newDate;
		}
		else if (dateFormat === "d") {
			// Set the time of the dateTime to 12AM
			return new Date(val.getFullYear(), val.getMonth(), val.getDate());
		}
	}

	return val;
}
