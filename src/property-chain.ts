import { Type, isEntityType, EntityType } from "./type";
import { Property } from "./property";
import { PropertyAccessEventArgs, PropertyChangeEventArgs, PropertyChangeEventHandler, PropertyAccessEventHandler } from "./property-path";
import { Event, EventSubscriber, EventPublisher } from "./events";
import { Entity, EntityConstructorForType } from "./entity";
import { Format } from "./format";
import { PropertyPath } from "./property-path";

/**
 * Encapsulates the logic required to work with a chain of properties and
 * a root object, allowing interaction with the chain as if it were a 
 * single property of the root object.
 */
export class PropertyChain implements PropertyPath {

	readonly rootType: Type;
	readonly properties: Property[];
	readonly changed: EventSubscriber<Entity, PropertyChangeEventArgs>;
	readonly accessed: EventSubscriber<Entity, PropertyAccessEventArgs>;

	private stepChanged: PropertyChangeEventHandler[];
	private stepAccessed: PropertyAccessEventHandler[];
	readonly path: string;

	constructor(rootType: Type, path: string) {

		// replace "." in type casts so that they do not interfere with splitting path
		path = path.replace(/<[^>]*>/ig, function (e) { return e.replace(/\./ig, function () { return "$_$"; }); });

		let currentType = rootType;
		this.properties = path.split(".").map(function (step) {

			let property: Property;

			// Regex pattern matches all letters and digits that are valid for javascript identifiers, including  "_"
			var parsed = step.match(/^([_0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u02bb-\u02c1\u02d0-\u02d1\u02e0-\u02e4\u02ee\u0370-\u0373\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua680-\ua697\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]+)(<([_$0-9a-zA-Z\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u02bb-\u02c1\u02d0-\u02d1\u02e0-\u02e4\u02ee\u0370-\u0373\u0376-\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0523\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0621-\u064a\u0660-\u0669\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07c0-\u07ea\u07f4-\u07f5\u07fa\u0904-\u0939\u093d\u0950\u0958-\u0961\u0966-\u096f\u0971-\u0972\u097b-\u097f\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09e6-\u09f1\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a66-\u0a6f\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0ae6-\u0aef\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b66-\u0b6f\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0be6-\u0bef\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58-\u0c59\u0c60-\u0c61\u0c66-\u0c6f\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0ce6-\u0cef\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d28\u0d2a-\u0d39\u0d3d\u0d60-\u0d61\u0d66-\u0d6f\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e87-\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa-\u0eab\u0ead-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0ed0-\u0ed9\u0edc-\u0edd\u0f00\u0f20-\u0f29\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8b\u1000-\u102a\u103f-\u1049\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u1090-\u1099\u10a0-\u10c5\u10d0-\u10fa\u10fc\u1100-\u1159\u115f-\u11a2\u11a8-\u11f9\u1200-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u1676\u1681-\u169a\u16a0-\u16ea\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u17e0-\u17e9\u1810-\u1819\u1820-\u1877\u1880-\u18a8\u18aa\u1900-\u191c\u1946-\u196d\u1970-\u1974\u1980-\u19a9\u19c1-\u19c7\u19d0-\u19d9\u1a00-\u1a16\u1b05-\u1b33\u1b45-\u1b4b\u1b50-\u1b59\u1b83-\u1ba0\u1bae-\u1bb9\u1c00-\u1c23\u1c40-\u1c49\u1c4d-\u1c7d\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u2094\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2183-\u2184\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2c6f\u2c71-\u2c7d\u2c80-\u2ce4\u2d00-\u2d25\u2d30-\u2d65\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3006\u3031-\u3035\u303b-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31b7\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fc3\ua000-\ua48c\ua500-\ua60c\ua610-\ua62b\ua640-\ua65f\ua662-\ua66e\ua680-\ua697\ua722-\ua788\ua78b-\ua78c\ua7fb-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8d0-\ua8d9\ua900-\ua925\ua930-\ua946\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa50-\uaa59\uac00-\ud7a3\uf900-\ufa2d\ufa30-\ufa6a\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc$]+)>)?$/i);
			if (parsed) {
				let property = currentType.getProperty(parsed[1]);
			}

			// Invalid property
			if (!property) {
				throw new Error(`Path '${path}' references unknown property '${step}' on type '${currentType}'.`);
			}

			// Ensure the property is not static because property chains are not valid for static properties
			if (property.isStatic) {
				throw new Error(`Path '${path}' references static property "${step}" on type '${currentType}'.`);
			}

			// Get the current type of the step
			currentType = (property.propertyType as EntityConstructorForType<Entity>).meta;
			if (parsed[3]) {
				currentType = rootType.model.types[parsed[3]];
			}

			// Return the property
			return property;
		});

		// create the accessed event and automatically subscribe to property accesses along the path when the event is used
		this.accessed = new Event<Entity, PropertyAccessEventArgs>((event) => {
			
			if (event.hasSubscribers() && !this.stepAccessed) {
				this.stepAccessed = [];
				let priorProp: Property;
				this.properties.forEach((property, index) => {
					let handler: PropertyAccessEventHandler;
					handler = args => { 
						this.rootType.known().forEach(known => {
							if (this.testConnection(known, args.entity, priorProp)) {
								(this.accessed as EventPublisher<Entity, PropertyAccessEventArgs>).publish(known, {
									entity: known,
									property: args.property,
									value: args.value,
								});
							}
						});
					};
					priorProp = property;
					this.stepAccessed[index] = handler;
					property.accessed.subscribe(handler);
				});
			}
			else if (!event.hasSubscribers() && this.stepAccessed) {
				this.properties.forEach((property, index) => property.accessed.unsubscribe(this.stepAccessed[index]));
				this.stepAccessed = null;
			}
		});

		// create the changed event and automatically subscribe to property changes along the path when the event is used
		this.changed = new Event<Entity, PropertyChangeEventArgs>((event) => {
			
			if (event.hasSubscribers() && !this.stepChanged) {
				this.stepChanged = [];
				let priorProp: Property;
				this.properties.forEach((property, index) => {
					let handler: PropertyChangeEventHandler;
					handler = args => { 
						this.rootType.known().forEach(known => {
							if (this.testConnection(known, args.entity, priorProp)) {
								(this.changed as EventPublisher<Entity, PropertyChangeEventArgs>).publish(known, {
									entity: known,
									property: args.property,
									oldValue: args.oldValue,
									newValue: args.newValue,
								});
							}
						});
					};
					priorProp = property;
					this.stepChanged[index] = handler;
					property.changed.subscribe(handler);
				});
			}
			else if (!event.hasSubscribers() && this.stepChanged) {
				this.properties.forEach((property, index) => property.changed.unsubscribe(this.stepChanged[index]));
				this.stepChanged = null;
			}
		});

		// calculate the path
		this.path = getPropertyChainPathFromIndex(this, 0);
	}

	equals(prop: PropertyPath): boolean {

		if (prop === null || prop === undefined) {
			return;
		}

		if (prop instanceof Property) {
			return this.properties.length === 1 && this.properties[0] === prop;
		}

		if (prop instanceof PropertyChain) {
			if (prop.properties.length !== this.properties.length) {
				return false;
			}

			for (var i = 0; i < this.properties.length; i++) {
				if (!this.properties[i].equals(prop.properties[i])) {
					return false;
				}
			}

			return true;
		}

	}

	/**
	 * Iterates over all objects along a property chain starting with the root object (obj).
	 * This is analogous to the Array forEach function. The callback may return a Boolean
	 * value to indicate whether or not to continue iterating.
	 * @param obj The root object (of type `IEntity`) to use in iterating over the chain.
	 * @param callback The function to invoke at each iteration step.  May return a Boolean value to indicate whether or not to continue iterating.
	 * @param thisPtr Optional object to use as the `this` pointer when invoking the callback.
	 * @param propFilter An optional property filter, if specified, only iterates over the results of this property.
	 */
	forEach(obj: Entity, callback: (obj: any, index: number, array: Array<any>, prop: Property, propIndex: number, props: Property[]) => any, thisPtr: any = null, propFilter: Property = null /*, target: IEntity, p: number, lastProp: IProperty */) {
		/// <summary>
		/// </summary>
	
		if (obj == null) throw new Error("Argument 'obj' cannot be null or undefined.");
		if (callback == null) throw new Error("Argument 'callback' cannot be null or undefined.");
		if (typeof (callback) != "function") throw new Error("Argument 'callback' must be of type function: " + callback + ".");
	
		// invoke callback on obj first
		var target: Entity = arguments[4] || obj;
		var lastProp: Property = arguments[6] || null;
		var props = this.properties.slice(arguments[5] || 0);
		for (var p: number = arguments[5] || 0; p < this.properties.length; p++) {
			var prop = this.properties[p];
			var isLastProperty = p === this.properties.length - 1;
			var canSkipRemainingProps = isLastProperty || (propFilter && lastProp === propFilter);
			var enableCallback = (!propFilter || lastProp === propFilter);
	
			// if the target is a list, invoke the callback once per item in the list
			if (target instanceof Array) {
				
				for (var i = 0; i < target.length; ++i) {

					if (enableCallback && callback.call(thisPtr || this, target[i], i, target, prop, p, props) === false) {
						return false;
					}

					if (!canSkipRemainingProps) {
						var targetValue = prop.value(target[i]);
						// continue along the chain for this list item
						if (!targetValue || PropertyChain.prototype.forEach.call(this, obj, callback, thisPtr, propFilter, targetValue, p + 1, prop) === false) {
							return false;
						}
					}
				}
				
				// subsequent properties already visited in preceding loop
				return true;
			} 
			else {
	
				// take into account any chain filters along the way
				if (enableCallback && callback.call(thisPtr || this, target, -1, null, prop, p, props) === false) {
					return false;
				}
			}
	
			// if a property filter is used and was just evaluated, stop early
			if (canSkipRemainingProps) {
				break;
			}
	
			// move to next property in the chain
			target = (target as any)[prop.fieldName];
	
			// break early if the target is undefined
			if (target === undefined || target === null) {
				break;
			}
	
			lastProp = prop;
		}
	
		return true;
	}

	get containingType(): Type {
		return this.rootType;
	}

	get firstProperty(): Property {
		return this.properties[0];
	}

	get lastProperty(): Property {
		return this.properties[this.properties.length - 1];
	}

	toPropertyArray(): Property[] {
		return this.properties.slice();
	}

	getLastTarget(obj: Entity): Entity {

		for (var p = 0; p < this.properties.length - 1; p++) {
			var prop = this.properties[p];

			// exit early on null or undefined
			if (!obj === undefined || obj === null)
				return obj;

			obj = prop.value(obj);
		}

		return obj;
	}

	canSetValue(obj: Entity, value: any): boolean {
		return this.lastProperty.canSetValue(this.getLastTarget(obj), value);
	}

	// Determines if this property chain connects two objects.
	testConnection(fromRoot: Entity, toObj: Entity, viaProperty: Property): boolean {
		var connected = false;

		// perform simple comparison if no property is defined
		if (!viaProperty) {
			return fromRoot === toObj;
		}

		this.forEach(fromRoot, function (target) {
			if (target === toObj) {
				connected = true;
				return false;
			}
		}, this, viaProperty);

		return connected;
	}

	get propertyType(): any {
		return this.lastProperty.propertyType;
	}

	get format(): Format<any> {
		return this.lastProperty.format;
	}

	get isList(): boolean {
		return this.lastProperty.isList;
	}

	get isStatic(): boolean {
		return this.lastProperty.isStatic;
	}

	get isCalculated(): boolean {
		return this.lastProperty.isCalculated;
	}

	get label(): string {
		return this.lastProperty.label;
	}

	get helptext(): string {
		return this.lastProperty.helptext;
	}

	get name() {
		return this.lastProperty.name;
	}

	value(obj: Entity = null, val: any = null, additionalArgs: any = null): any {
		var lastTarget = this.getLastTarget(obj);
		var lastProp = this.lastProperty;

		if (arguments.length > 1) {
			lastProp.value(lastTarget, val, additionalArgs);
		} else if (lastTarget) {
			return lastProp.value(lastTarget);
		}
	}

	/**
	 * Determines if the property chain is initialized, akin to single IProperty initialization.
	 * @param obj The root object
	 * @param enforceCompleteness Whether or not the chain must be complete in order to be considered initialized
	 */
	isInited(obj: Entity, enforceCompleteness: boolean = false /*, fromIndex: number, fromProp: IProperty */) {
		var allInited = true, initedProperties: Property[] = [], fromIndex = arguments[2] || 0, fromProp = arguments[3] || null, expectedProps = this.properties.length - fromIndex;

		PropertyChain.prototype.forEach.call(this, obj, function (target: any, targetIndex: number, targetArray: any[], property: Property, propertyIndex: number, properties: Property[]) {
			if (targetArray && enforceCompleteness) {
				if (targetArray.every(function (item) { return this.isInited(item, true, propertyIndex, properties[propertyIndex - 1]); }, this)) {
					Array.prototype.push.apply(initedProperties, properties.slice(propertyIndex));
				}
				else {
					allInited = false;
				}

				// Stop iterating at an array value
				return false;
			}
			else {
				if (!property.isInited(target)) {
					allInited = false;

					// Exit immediately since chain is not inited
					return false;
				} else if (!targetArray || targetIndex === 0) {
					initedProperties.push(property);
				}
			}
		}, this, null, obj, fromIndex, fromProp);

		return allInited && (!enforceCompleteness || initedProperties.length === expectedProps);
	}

	toString() {
		var path = this.properties.map(function (e) { return e.name; }).join(".");
		return `this<${this.rootType}>.${path}`;
	}

}

export interface PropertyChainConstructor {
	new(rootType: Type, properties: Property[], filters: ((obj: Entity) => boolean)[]): PropertyChain;
}

function getPropertyChainPathFromIndex(chain: PropertyChain, startIndex: number) {

	var steps: string[] = [];

	let props = chain.toPropertyArray();

	if (props[startIndex].isStatic) {
		steps.push(props[startIndex].containingType.fullName);
	}

	let previousStepType: Type;

	props.slice(startIndex).forEach(function (p, i) {
		if (i !== 0) {
			if (p.containingType !== previousStepType && (p.containingType as Type).isSubclassOf(previousStepType)) {
				steps[steps.length - 1] = steps[steps.length - 1] + "<" + p.containingType.fullName + ">";
			}
		}
		steps.push(p.name);
		previousStepType = (p.propertyType as EntityType).meta;
	});

	return steps.join(".");
}