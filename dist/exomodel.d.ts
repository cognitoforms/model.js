declare module 'exomodel/core/helpers' {
	export function ensureNamespace(name: string, parentNamespace: any): any;
	export function navigateAttribute(obj: any, attr: string, callback: Function, thisPtr?: any): void;
	export function evalPath(obj: any, path: string, nullValue?: any, undefinedValue?: any): any;
	export function parseFunctionName(fn: Function): string;
	export function getTypeName(obj: any): any;
	export function getDefaultValue(isList: boolean, jstype: any): any;
	export function randomInteger(min?: number, max?: number): number;
	export function randomText(len: number, includeDigits?: boolean): string;
	export function toTitleCase(input: string): string;

}
declare module 'exomodel/core/internals' {
	export function createSecret(key: string, len?: number, includeLetters?: boolean, includeDigits?: boolean, prefix?: string): string;
	export function getSecret(key: string): string;

}
declare module 'exomodel/core/observable-list' {
	import { EventDispatcher, IEvent } from "ste-events";
	export interface ObservableListChangedArgs<ItemType> {
	    added: ItemType[];
	    addedIndex: number;
	    removed: ItemType[];
	    removedIndex: number;
	}
	export abstract class ObservableList<ItemType> extends Array<ItemType> {
	    /**
	     * Creates a new observable list
	     * @param items The array of initial items
	     */
	    protected constructor(items?: ItemType[]);
	    abstract changed: IEvent<Array<ItemType>, ObservableListChangedArgs<ItemType>>;
	    abstract add(item: ItemType): void;
	    abstract remove(item: ItemType): boolean;
	    static isObservableList<ItemType>(array: Array<ItemType>): boolean;
	    protected static _markObservable(target: any): void;
	    static ensureObservable<ItemType>(array: Array<ItemType> | ObservableListImplementation<ItemType>): ObservableList<ItemType>;
	    static create<ItemType>(items?: ItemType[]): ObservableList<ItemType>;
	} class ObservableListImplementation<ItemType> extends ObservableList<ItemType> {
	    readonly _changedEvent: EventDispatcher<Array<ItemType>, ObservableListChangedArgs<ItemType>>;
	    /**
	     * Creates a new observable list
	     * @param items The array of initial items
	     */
	    constructor(items?: ItemType[]);
	    private static _initFields;
	    static implementObservableList<ItemType>(array: Array<ItemType> | ObservableListImplementation<ItemType>): ObservableList<ItemType>;
	    /**
	     * Add an item and raise the list changed event.
	     * @param item The item to add
	     */
	    add(item: ItemType): void;
	    /**
	     * Removes the specified item from the list.
	     * @param item The item to remove.
	     * @returns True if removed, otherwise false.
	     */
	    remove(item: ItemType): boolean;
	    /** Expose the changed event */
	    readonly changed: IEvent<Array<ItemType>, ObservableListChangedArgs<ItemType>>;
	}
	export {};

}
declare module 'exomodel/core/format' {
	 type FormatConvertFunction = (value: any) => string; type FormatConvertBackFunction = (value: string) => string;
	export interface FormatOptions {
	    specifier: string;
	    convert: FormatConvertFunction;
	    convertBack?: FormatConvertBackFunction;
	    formatEval?: (value: string) => string;
	    description?: string;
	    nullString?: string;
	    undefinedString?: string;
	}
	export class Format {
	    specifier: string;
	    convertFn: FormatConvertFunction;
	    convertBackFn: FormatConvertBackFunction;
	    formatEval: (value: string) => string;
	    description: string;
	    nullString: string;
	    undefinedString: string;
	    constructor(options: FormatOptions);
	    convert(val: any): string;
	    convertBack(val: string): any;
	    toString(): string;
	}
	export {};

}
declare module 'exomodel/core/property' {
	import { Type } from 'exomodel/core/type';
	import { Entity } from 'exomodel/core/entity';
	import { EventDispatcher, IEvent } from "ste-events";
	import { Format } from 'exomodel/core/format';
	export interface PropertyEventArgs {
	    property: Property;
	}
	export interface PropertyAccessEventArgs extends PropertyEventArgs {
	    value: any;
	}
	export interface PropertyChangeEventArgs extends PropertyEventArgs {
	    newValue: any;
	    oldValue: any;
	} class PropertyEventDispatchers {
	    readonly changed: EventDispatcher<Entity, PropertyChangeEventArgs>;
	    readonly accessed: EventDispatcher<Entity, PropertyAccessEventArgs>;
	    constructor();
	}
	export class Property {
	    readonly containingType: Type;
	    readonly name: string;
	    readonly jstype: any;
	    readonly isList: boolean;
	    readonly isStatic: boolean;
	    helptext: string;
	    isPersisted: boolean;
	    isCalculated: boolean;
	    private _label;
	    private _format;
	    private _origin;
	    private _defaultValue;
	    readonly _eventDispatchers: PropertyEventDispatchers;
	    readonly _getter: (args?: any) => any;
	    readonly _setter: (value: any, args?: any) => void;
	    constructor(containingType: Type, name: string, jstype: any, label: string, helptext: string, format: Format, isList: boolean, isStatic: boolean, isPersisted: boolean, isCalculated: boolean, defaultValue?: any, origin?: string);
	    readonly fieldName: string;
	    readonly changedEvent: IEvent<Entity, PropertyChangeEventArgs>;
	    readonly accessedEvent: IEvent<Entity, PropertyAccessEventArgs>;
	    equals(prop: Property): boolean;
	    toString(): string;
	    isDefinedBy(type: Type): boolean;
	    readonly label: string;
	    readonly format: Format;
	    readonly origin: string;
	    readonly defaultValue: any;
	    getPath(): string;
	    canSetValue(obj: Entity, val: any): any;
	    value(obj: Entity, val?: any, additionalArgs?: any): any;
	    rootedPath(type: Type): string;
	}
	export function Property$_generateShortcuts(property: Property, target: any, recurse?: boolean, overwrite?: boolean): void;
	export function Property$_generateStaticProperty(property: Property): void;
	export function Property$_generatePrototypeProperty(property: Property): void;
	export function Property$_generateOwnProperty(property: Property, obj: Entity): void;
	export function Property$_generateOwnPropertyWithClosure(property: Property, obj: Entity): void;
	export {};

}
declare module 'exomodel/core/model' {
	import { Type } from 'exomodel/core/type';
	import { EventDispatcher, IEvent } from "ste-events";
	import { Entity } from 'exomodel/core/entity';
	import { Property } from 'exomodel/core/property';
	export interface NamespaceOrConstructor {
	    [name: string]: NamespaceOrConstructor;
	}
	export interface ModelTypeAddedEventArgs {
	    type: Type;
	}
	export interface ModelEntityRegisteredEventArgs {
	    entity: Entity;
	}
	export interface ModelEntityUnregisteredEventArgs {
	    entity: Entity;
	}
	export interface ModelPropertyAddedEventArgs {
	    property: Property;
	}
	export interface ModelSettings {
	    createOwnProperties: boolean;
	} class ModelEventDispatchers {
	    readonly typeAdded: EventDispatcher<Model, ModelTypeAddedEventArgs>;
	    readonly entityRegistered: EventDispatcher<Model, ModelEntityRegisteredEventArgs>;
	    readonly entityUnregistered: EventDispatcher<Model, ModelEntityUnregisteredEventArgs>;
	    readonly propertyAdded: EventDispatcher<Model, ModelPropertyAddedEventArgs>;
	    constructor();
	}
	export let Model$_allTypesRoot: NamespaceOrConstructor;
	export class Model {
	    readonly _types: {
	        [name: string]: Type;
	    };
	    readonly _settings: ModelSettings;
	    readonly _eventDispatchers: ModelEventDispatchers;
	    constructor(createOwnProperties?: boolean);
	    readonly typeAddedEvent: IEvent<Model, ModelTypeAddedEventArgs>;
	    readonly entityRegisteredEvent: IEvent<Model, ModelEntityRegisteredEventArgs>;
	    readonly entityUnregisteredEvent: IEvent<Model, ModelEntityUnregisteredEventArgs>;
	    readonly propertyAddedEvent: IEvent<Model, ModelPropertyAddedEventArgs>;
	    dispose(): void;
	    readonly types: Array<Type>;
	    addType(name: string, baseType?: Type, origin?: string): Type;
	    /**
	     * Retrieves the JavaScript constructor function corresponding to the given full type name.
	     * @param name The name of the type
	     */
	    static getJsType(name: string, allowUndefined?: boolean): any;
	}
	export {};

}
declare module 'exomodel/core/type' {
	import { Model } from 'exomodel/core/model';
	import { Entity } from 'exomodel/core/entity';
	import { Property } from 'exomodel/core/property';
	import { EventDispatcher, IEvent } from "ste-events";
	import { ObservableList } from 'exomodel/core/observable-list';
	import { Format } from 'exomodel/core/format';
	export interface TypeEntityInitNewEventArgs {
	    entity: Entity;
	}
	export interface TypeEntityInitExistingEventArgs {
	    entity: Entity;
	}
	export interface TypeEntityDestroyEventArgs {
	    entity: Entity;
	} class TypeEventDispatchers {
	    readonly initNew: EventDispatcher<Type, TypeEntityInitNewEventArgs>;
	    readonly initExisting: EventDispatcher<Type, TypeEntityInitExistingEventArgs>;
	    readonly destroy: EventDispatcher<Type, TypeEntityDestroyEventArgs>;
	    constructor();
	}
	export interface TypePropertyOptions {
	    label?: string;
	    helptext?: string;
	    format?: Format;
	    isPersisted?: boolean;
	    isCalculated?: boolean;
	    defaultValue?: any;
	}
	export class Type {
	    readonly model: Model;
	    readonly fullName: string;
	    readonly jstype: any;
	    readonly baseType: Type;
	    origin: string;
	    originForNewProperties: string;
	    private _counter;
	    private _known;
	    private readonly _pool;
	    private readonly _legacyPool;
	    private readonly _properties;
	    private readonly _derivedTypes;
	    readonly _eventDispatchers: TypeEventDispatchers;
	    constructor(model: Model, fullName: string, baseType?: Type, origin?: string);
	    readonly destroyEvent: IEvent<Type, TypeEntityDestroyEventArgs>;
	    readonly initNewEvent: IEvent<Type, TypeEntityInitNewEventArgs>;
	    readonly initExistingEvent: IEvent<Type, TypeEntityInitExistingEventArgs>;
	    static newIdPrefix: string;
	    newId(): string;
	    register(obj: Entity, id: string, suppressModelEvent?: boolean): void;
	    changeObjectId(oldId: string, newId: string): Entity;
	    unregister(obj: Entity): void;
	    get(id: string, exactTypeOnly?: boolean): Entity;
	    known(): ObservableList<Entity>;
	    addProperty(name: string, jstype: any, isList: boolean, isStatic: boolean, options?: TypePropertyOptions): Property;
	    property(name: string): Property;
	    readonly properties: Array<Property>;
	    readonly derivedTypes: Type[];
	    isSubclassOf(type: Type): boolean;
	    toString(): string;
	}
	export {};

}
declare module 'exomodel/core/object-meta' {
	import { Type } from 'exomodel/core/type';
	import { Entity } from 'exomodel/core/entity';
	export class ObjectMeta {
	    readonly type: Type;
	    readonly entity: Entity;
	    private _id;
	    private _isNew;
	    private _legacyId;
	    constructor(type: Type, entity: Entity, id: string, isNew: boolean);
	    id: string;
	    readonly isNew: boolean;
	    legacyId: string;
	    destroy(): void;
	}

}
declare module 'exomodel/core/entity' {
	import { ObjectMeta } from 'exomodel/core/object-meta';
	export class Entity {
	    readonly meta: ObjectMeta;
	    init(properties: {
	        [name: string]: any;
	    }): void;
	    init(property: string, value: any): void;
	    set(properties: {
	        [name: string]: any;
	    }): void;
	    set(property: string, value: any): void;
	    get(property: string): any;
	    toString(format: string): string;
	    static toIdString(obj: Entity): string;
	    static fromIdString(idString: string): any;
	}

}
declare module 'exomodel/main' {
	export { Entity } from 'exomodel/core/entity';
	export { Property } from 'exomodel/core/property';
	export { Type } from 'exomodel/core/type';
	export { Model } from 'exomodel/core/model';

}
