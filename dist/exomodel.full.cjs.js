/*!
 * ExoModel.js v0.0.1
 * (c) 2018 Cognito LLC
 * Released under the MIT License.
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var management = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Allows the user to interact with the event.
 *
 * @class EventManagement
 * @implements {IEventManagement}
 */
var EventManagement = /** @class */ (function () {
    function EventManagement(unsub) {
        this.unsub = unsub;
        this.propagationStopped = false;
    }
    EventManagement.prototype.stopPropagation = function () {
        this.propagationStopped = true;
    };
    return EventManagement;
}());
exports.EventManagement = EventManagement;
});

unwrapExports(management);
var management_1 = management.EventManagement;

var subscription = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Stores a handler. Manages execution meta data.
 * @class Subscription
 * @template TEventHandler
 */
var Subscription = /** @class */ (function () {
    /**
     * Creates an instance of Subscription.
     *
     * @param {TEventHandler} handler The handler for the subscription.
     * @param {boolean} isOnce Indicates if the handler should only be executed once.
     */
    function Subscription(handler, isOnce) {
        this.handler = handler;
        this.isOnce = isOnce;
        /**
         * Indicates if the subscription has been executed before.
         */
        this.isExecuted = false;
    }
    /**
     * Executes the handler.
     *
     * @param {boolean} executeAsync True if the even should be executed async.
     * @param {*} scope The scope the scope of the event.
     * @param {IArguments} args The arguments for the event.
     */
    Subscription.prototype.execute = function (executeAsync, scope, args) {
        if (!this.isOnce || !this.isExecuted) {
            this.isExecuted = true;
            var fn = this.handler;
            if (executeAsync) {
                setTimeout(function () {
                    fn.apply(scope, args);
                }, 1);
            }
            else {
                fn.apply(scope, args);
            }
        }
    };
    return Subscription;
}());
exports.Subscription = Subscription;
});

unwrapExports(subscription);
var subscription_1 = subscription.Subscription;

var dispatching = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });


/**
 * Base class for implementation of the dispatcher. It facilitates the subscribe
 * and unsubscribe methods based on generic handlers. The TEventType specifies
 * the type of event that should be exposed. Use the asEvent to expose the
 * dispatcher as event.
 */
var DispatcherBase = /** @class */ (function () {
    function DispatcherBase() {
        this._wrap = new DispatcherWrapper(this);
        this._subscriptions = new Array();
    }
    /**
     * Subscribe to the event dispatcher.
     * @param fn The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    DispatcherBase.prototype.subscribe = function (fn) {
        var _this = this;
        if (fn) {
            this._subscriptions.push(new subscription.Subscription(fn, false));
        }
        return function () {
            _this.unsubscribe(fn);
        };
    };
    /**
     * Subscribe to the event dispatcher.
     * @param fn The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    DispatcherBase.prototype.sub = function (fn) {
        return this.subscribe(fn);
    };
    /**
     * Subscribe once to the event with the specified name.
     * @param fn The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    DispatcherBase.prototype.one = function (fn) {
        var _this = this;
        if (fn) {
            this._subscriptions.push(new subscription.Subscription(fn, true));
        }
        return function () {
            _this.unsubscribe(fn);
        };
    };
    /**
     * Checks it the event has a subscription for the specified handler.
     * @param fn The event handler.
     */
    DispatcherBase.prototype.has = function (fn) {
        if (!fn)
            return false;
        return this._subscriptions.some(function (sub) { return sub.handler == fn; });
    };
    /**
     * Unsubscribes the handler from the dispatcher.
     * @param fn The event handler.
     */
    DispatcherBase.prototype.unsubscribe = function (fn) {
        if (!fn)
            return;
        for (var i = 0; i < this._subscriptions.length; i++) {
            if (this._subscriptions[i].handler == fn) {
                this._subscriptions.splice(i, 1);
                break;
            }
        }
    };
    /**
     * Unsubscribes the handler from the dispatcher.
     * @param fn The event handler.
     */
    DispatcherBase.prototype.unsub = function (fn) {
        this.unsubscribe(fn);
    };
    /**
     * Generic dispatch will dispatch the handlers with the given arguments.
     *
     * @protected
     * @param {boolean} executeAsync True if the even should be executed async.
     * @param {*} The scope the scope of the event. The scope becomes the "this" for handler.
     * @param {IArguments} args The arguments for the event.
     */
    DispatcherBase.prototype._dispatch = function (executeAsync, scope, args) {
        var _this = this;
        var _loop_1 = function (sub) {
            var ev = new management.EventManagement(function () { return _this.unsub(sub.handler); });
            var nargs = Array.prototype.slice.call(args);
            nargs.push(ev);
            sub.execute(executeAsync, scope, nargs);
            //cleanup subs that are no longer needed
            this_1.cleanup(sub);
            if (!executeAsync && ev.propagationStopped) {
                return "break";
            }
        };
        var this_1 = this;
        //execute on a copy because of bug #9
        for (var _i = 0, _a = this._subscriptions.slice(); _i < _a.length; _i++) {
            var sub = _a[_i];
            var state_1 = _loop_1(sub);
            if (state_1 === "break")
                break;
        }
    };
    /**
     * Cleans up subs that ran and should run only once.
     */
    DispatcherBase.prototype.cleanup = function (sub) {
        if (sub.isOnce && sub.isExecuted) {
            var i = this._subscriptions.indexOf(sub);
            if (i > -1) {
                this._subscriptions.splice(i, 1);
            }
        }
    };
    /**
     * Creates an event from the dispatcher. Will return the dispatcher
     * in a wrapper. This will prevent exposure of any dispatcher methods.
     */
    DispatcherBase.prototype.asEvent = function () {
        return this._wrap;
    };
    /**
     * Clears all the subscriptions.
     */
    DispatcherBase.prototype.clear = function () {
        this._subscriptions.splice(0, this._subscriptions.length);
    };
    return DispatcherBase;
}());
exports.DispatcherBase = DispatcherBase;
/**
 * Base class for event lists classes. Implements the get and remove.
 */
var EventListBase = /** @class */ (function () {
    function EventListBase() {
        this._events = {};
    }
    /**
     * Gets the dispatcher associated with the name.
     * @param name The name of the event.
     */
    EventListBase.prototype.get = function (name) {
        var event = this._events[name];
        if (event) {
            return event;
        }
        event = this.createDispatcher();
        this._events[name] = event;
        return event;
    };
    /**
     * Removes the dispatcher associated with the name.
     * @param name The name of the event.
     */
    EventListBase.prototype.remove = function (name) {
        delete this._events[name];
    };
    return EventListBase;
}());
exports.EventListBase = EventListBase;
/**
 * Hides the implementation of the event dispatcher. Will expose methods that
 * are relevent to the event.
 */
var DispatcherWrapper = /** @class */ (function () {
    /**
     * Creates a new EventDispatcherWrapper instance.
     * @param dispatcher The dispatcher.
     */
    function DispatcherWrapper(dispatcher) {
        this._subscribe = function (fn) { return dispatcher.subscribe(fn); };
        this._unsubscribe = function (fn) { return dispatcher.unsubscribe(fn); };
        this._one = function (fn) { return dispatcher.one(fn); };
        this._has = function (fn) { return dispatcher.has(fn); };
        this._clear = function () { return dispatcher.clear(); };
    }
    /**
     * Subscribe to the event dispatcher.
     * @param fn The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    DispatcherWrapper.prototype.subscribe = function (fn) {
        return this._subscribe(fn);
    };
    /**
     * Subscribe to the event dispatcher.
     * @param fn The event handler that is called when the event is dispatched.
     * @returns A function that unsubscribes the event handler from the event.
     */
    DispatcherWrapper.prototype.sub = function (fn) {
        return this.subscribe(fn);
    };
    /**
     * Unsubscribe from the event dispatcher.
     * @param fn The event handler that is called when the event is dispatched.
     */
    DispatcherWrapper.prototype.unsubscribe = function (fn) {
        this._unsubscribe(fn);
    };
    /**
     * Unsubscribe from the event dispatcher.
     * @param fn The event handler that is called when the event is dispatched.
     */
    DispatcherWrapper.prototype.unsub = function (fn) {
        this.unsubscribe(fn);
    };
    /**
     * Subscribe once to the event with the specified name.
     * @param fn The event handler that is called when the event is dispatched.
     */
    DispatcherWrapper.prototype.one = function (fn) {
        return this._one(fn);
    };
    /**
     * Checks it the event has a subscription for the specified handler.
     * @param fn The event handler.
     */
    DispatcherWrapper.prototype.has = function (fn) {
        return this._has(fn);
    };
    /**
     * Clears all the subscriptions.
     */
    DispatcherWrapper.prototype.clear = function () {
        this._clear();
    };
    return DispatcherWrapper;
}());
exports.DispatcherWrapper = DispatcherWrapper;
});

unwrapExports(dispatching);
var dispatching_1 = dispatching.DispatcherBase;
var dispatching_2 = dispatching.EventListBase;
var dispatching_3 = dispatching.DispatcherWrapper;

var dist = createCommonjsModule(function (module, exports) {
/*!
 * Strongly Typed Events for TypeScript - Core
 * https://github.com/KeesCBakker/StronlyTypedEvents/
 * http://keestalkstech.com
 *
 * Copyright Kees C. Bakker / KeesTalksTech
 * Released under the MIT license
 */
Object.defineProperty(exports, "__esModule", { value: true });

exports.DispatcherBase = dispatching.DispatcherBase;
exports.DispatcherWrapper = dispatching.DispatcherWrapper;
exports.EventListBase = dispatching.EventListBase;

exports.Subscription = subscription.Subscription;
});

unwrapExports(dist);
var dist_1 = dist.DispatcherBase;
var dist_2 = dist.DispatcherWrapper;
var dist_3 = dist.EventListBase;
var dist_4 = dist.Subscription;

var events = createCommonjsModule(function (module, exports) {
var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });

/**
 * Dispatcher implementation for events. Can be used to subscribe, unsubscribe
 * or dispatch events. Use the ToEvent() method to expose the event.
 */
var EventDispatcher = /** @class */ (function (_super) {
    __extends(EventDispatcher, _super);
    /**
     * Creates a new EventDispatcher instance.
     */
    function EventDispatcher() {
        return _super.call(this) || this;
    }
    /**
     * Dispatches the event.
     * @param sender The sender.
     * @param args The arguments object.
     */
    EventDispatcher.prototype.dispatch = function (sender, args) {
        this._dispatch(false, this, arguments);
    };
    /**
     * Dispatches the events thread.
     * @param sender The sender.
     * @param args The arguments object.
     */
    EventDispatcher.prototype.dispatchAsync = function (sender, args) {
        this._dispatch(true, this, arguments);
    };
    /**
     * Creates an event from the dispatcher. Will return the dispatcher
     * in a wrapper. This will prevent exposure of any dispatcher methods.
     */
    EventDispatcher.prototype.asEvent = function () {
        return _super.prototype.asEvent.call(this);
    };
    return EventDispatcher;
}(dist.DispatcherBase));
exports.EventDispatcher = EventDispatcher;
/**
 * Storage class for multiple events that are accessible by name.
 * Events dispatchers are automatically created.
 */
var EventList = /** @class */ (function (_super) {
    __extends(EventList, _super);
    /**
     * Creates a new EventList instance.
     */
    function EventList() {
        return _super.call(this) || this;
    }
    /**
     * Creates a new dispatcher instance.
     */
    EventList.prototype.createDispatcher = function () {
        return new EventDispatcher();
    };
    return EventList;
}(dist.EventListBase));
exports.EventList = EventList;
/**
 * Extends objects with event handling capabilities.
 */
var EventHandlingBase = /** @class */ (function () {
    function EventHandlingBase() {
        this._events = new EventList();
    }
    Object.defineProperty(EventHandlingBase.prototype, "events", {
        /**
         * Gets the list with all the event dispatchers.
         */
        get: function () {
            return this._events;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Subscribes to the event with the specified name.
     * @param name The name of the event.
     * @param fn The event handler.
     */
    EventHandlingBase.prototype.subscribe = function (name, fn) {
        this._events.get(name).subscribe(fn);
    };
    /**
     * Subscribes to the event with the specified name.
     * @param name The name of the event.
     * @param fn The event handler.
     */
    EventHandlingBase.prototype.sub = function (name, fn) {
        this.subscribe(name, fn);
    };
    /**
     * Unsubscribes from the event with the specified name.
     * @param name The name of the event.
     * @param fn The event handler.
     */
    EventHandlingBase.prototype.unsubscribe = function (name, fn) {
        this._events.get(name).unsubscribe(fn);
    };
    /**
     * Unsubscribes from the event with the specified name.
     * @param name The name of the event.
     * @param fn The event handler.
     */
    EventHandlingBase.prototype.unsub = function (name, fn) {
        this.unsubscribe(name, fn);
    };
    /**
     * Subscribes to once the event with the specified name.
     * @param name The name of the event.
     * @param fn The event handler.
     */
    EventHandlingBase.prototype.one = function (name, fn) {
        this._events.get(name).one(fn);
    };
    /**
     * Subscribes to once the event with the specified name.
     * @param name The name of the event.
     * @param fn The event handler.
     */
    EventHandlingBase.prototype.has = function (name, fn) {
        return this._events.get(name).has(fn);
    };
    return EventHandlingBase;
}());
exports.EventHandlingBase = EventHandlingBase;
});

unwrapExports(events);
var events_1 = events.EventDispatcher;
var events_2 = events.EventList;
var events_3 = events.EventHandlingBase;

var dist$1 = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });

exports.EventDispatcher = events.EventDispatcher;
exports.EventHandlingBase = events.EventHandlingBase;
exports.EventList = events.EventList;
});

unwrapExports(dist$1);
var dist_1$1 = dist$1.EventDispatcher;
var dist_2$1 = dist$1.EventHandlingBase;
var dist_3$1 = dist$1.EventList;

var intrinsicJsTypes = ["Object", "String", "Number", "Boolean", "Date", "TimeSpan", "Array"];
var Model = /** @class */ (function () {
    function Model() {
        this._types = {};
        this._typeAddedEvent = new dist_1$1();
        this._entityRegisteredEvent = new dist_1$1();
        this._entityUnregisteredEvent = new dist_1$1();
    }
    Object.defineProperty(Model.prototype, "typeAdded", {
        get: function () {
            return this._typeAddedEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Model.prototype, "entityRegistered", {
        get: function () {
            return this._entityRegisteredEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Model.prototype, "entityUnregistered", {
        get: function () {
            return this._entityUnregisteredEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Model.prototype.dispose = function () {
        // TODO
        // for (var key in this._types) {
        // 	delete window[key];
        // }
    };
    Model.prototype.addType = function (name, baseType, origin) {
        if (baseType === void 0) { baseType = null; }
        if (origin === void 0) { origin = "client"; }
        var type = new Type(this, name, baseType, origin);
        this._types[name] = type;
        this._typeAddedEvent.dispatch(this, { type: type });
        return type;
    };
    /**
     * Retrieves the JavaScript constructor function corresponding to the given full type name.
     * @param name The name of the type
     */
    Model.getJsType = function (name, allowUndefined) {
        if (allowUndefined === void 0) { allowUndefined = false; }
        var obj = Model._allTypesRoot;
        var steps = name.split(".");
        if (steps.length === 1 && intrinsicJsTypes.indexOf(name) > -1) {
            return window[name];
        }
        else {
            for (var i = 0; i < steps.length; i++) {
                var step = steps[i];
                obj = obj[step];
                if (obj === undefined) {
                    if (allowUndefined) {
                        return;
                    }
                    else {
                        throw new Error("The type \"" + name + "\" could not be found.  Failed on step \"" + step + "\".");
                    }
                }
            }
            return obj;
        }
    };
    Model._allTypesRoot = {};
    return Model;
}());

var Entity = /** @class */ (function () {
    function Entity() {
    }
    Entity.prototype.init = function (property, value) {
        var properties;
        // Convert property/value pair to a property dictionary
        if (typeof property == "string")
            (properties = {})[property] = value;
        else
            properties = property;
        // Initialize the specified properties
        for (var name in properties) {
            var prop = this.meta.type.property(name);
            if (!prop)
                throw new Error("Could not find property \"" + name + "\" on type \"" + this.meta.type.fullName + "\".");
            // Set the property
            prop.value(this, value);
        }
    };
    Entity.prototype.set = function (property, value) {
        var properties;
        // Convert property/value pair to a property dictionary
        if (typeof property == "string")
            (properties = {})[property] = value;
        else
            properties = property;
        // Set the specified properties
        for (var name in properties) {
            var prop = this.meta.type.property(name);
            if (!prop)
                throw new Error("Could not find property \"" + name + "\" on type \"" + this.meta.type.fullName + "\".");
            prop.set(this, value, false);
        }
    };
    Entity.prototype.get = function (property) {
        return this.meta.type.property(property).value(this);
    };
    Entity.prototype.toString = function (format) {
        if (format)
            return format.convert(this);
        else
            return Entity.toIdString(this);
    };
    // Gets the typed string id suitable for roundtripping via fromIdString
    Entity.toIdString = function (obj) {
        return obj.meta.type.get_fullName() + "|" + obj.meta.id;
    };
    // Gets or loads the entity with the specified typed string id
    Entity.fromIdString = function (idString) {
        // Typed identifiers take the form "type|id".
        var type = idString.substring(0, idString.indexOf("|"));
        var id = idString.substring(type.length + 1);
        // Use the left-hand portion of the id string as the object's type.
        var jstype = Model.getJsType(type);
        // Retrieve the object with the given id.
        return jstype.meta.get(id, 
        // Typed identifiers may or may not be the exact type of the instance.
        // An id string may be constructed with only knowledge of the base type.
        false);
    };
    return Entity;
}());

function ensureNamespace(name, parentNamespace) {
    var result, nsTokens, target = parentNamespace;
    if (target.constructor === String) {
        nsTokens = target.split(".");
        target = window;
        nsTokens.forEach(function (token) {
            target = target[token];
            if (target === undefined) {
                throw new Error("Parent namespace \"" + parentNamespace + "\" could not be found.");
            }
        });
    }
    else if (target === undefined || target === null) {
        target = window;
    }
    // create the namespace object if it doesn't exist, otherwise return the existing namespace
    if (!(name in target)) {
        result = target[name] = {};
        return result;
    }
    else {
        return target[name];
    }
}
function navigateAttribute(obj, attr, callback, thisPtr) {
    if (thisPtr === void 0) { thisPtr = null; }
    for (var val = obj[attr]; val != null; val = val[attr]) {
        if (callback.call(thisPtr || obj, val) === false) {
            return;
        }
    }
}
var funcRegex = /function\s*([\w_\$]*)/i;
function parseFunctionName(f) {
    var result = funcRegex.exec(f);
    return result ? (result[1] || "{anonymous}") : "{anonymous}";
}
var typeNameExpr = /\s([a-z|A-Z]+)/;
function getTypeName(obj) {
    if (obj === undefined)
        return "undefined";
    if (obj === null)
        return "null";
    return Object.prototype.toString.call(obj).match(typeNameExpr)[1].toLowerCase();
}
function getDefaultValue(isList, jstype) {
    if (isList)
        return [];
    if (jstype === Boolean)
        return false;
    if (jstype === Number)
        return 0;
    return null;
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var ObservableList = /** @class */ (function (_super) {
    __extends(ObservableList, _super);
    /**
     * Creates a new model list with the specified owner.
     * @param owner
     */
    function ObservableList(owner, items) {
        if (items === void 0) { items = null; }
        var _this = _super.apply(this, items) || this;
        _this.owner = owner;
        return _this;
    }
    /**
     * Override push to raise the list changed event.
     * @param items The item or items to add
     */
    ObservableList.prototype.push = function () {
        var items = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i];
        }
        var result = _super.prototype.push.call(items);
        this.changedEvent.dispatch(this.owner, { added: items, removed: [] });
        return result;
    };
    /** Override pop to raise the list changed event. */
    ObservableList.prototype.pop = function () {
        var result = _super.prototype.pop.call(this);
        this.changedEvent.dispatch(this.owner, { added: [], removed: [result] });
        return result;
    };
    /**
     * Override unshift to raise the list changed event.
     * @param items The item or items to add
     */
    ObservableList.prototype.unshift = function () {
        var items = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i];
        }
        var result = _super.prototype.unshift.call(items);
        this.changedEvent.dispatch(this.owner, { added: items, removed: [] });
        return result;
    };
    /**
     * Override splice to raise the list changed event.
     * @param items The item or items to add
     */
    ObservableList.prototype.splice = function (start, deleteCount) {
        var itemsToAdd = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            itemsToAdd[_i - 2] = arguments[_i];
        }
        var removed = _super.prototype.splice.call(start, deleteCount, itemsToAdd);
        this.changedEvent.dispatch(this.owner, { added: itemsToAdd, removed: removed });
        return removed;
    };
    /** Override shift to raise the list changed event. */
    ObservableList.prototype.shift = function () {
        var result = _super.prototype.shift.call(this);
        this.changedEvent.dispatch(this.owner, { added: [], removed: [result] });
        return result;
    };
    /** Override sort to raise the list changed event. */
    ObservableList.prototype.sort = function () {
        _super.prototype.sort.call(this);
        this.changedEvent.dispatch(this.owner, { added: [], removed: [] });
        return this;
    };
    /** Override reverse to raise the list changed event. */
    ObservableList.prototype.reverse = function () {
        var result = _super.prototype.reverse.call(this);
        this.changedEvent.dispatch(this.owner, { added: [], removed: [] });
        return result;
    };
    /**
     * Removes the specified item from the list.
     * @param item The item to remove.
     * @returns True if removed, otherwise false.
     */
    ObservableList.prototype.remove = function (item) {
        var index = this.indexOf(item);
        if (index > -1)
            this.splice(index, 1);
        return index > -1;
    };
    Object.defineProperty(ObservableList.prototype, "changed", {
        /** Expose the changed event */
        get: function () {
            return this.changedEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    return ObservableList;
}(Array));

function initializeProperty(obj, property, val, force) {
    if (force === void 0) { force = false; }
    var target = (property.isStatic ? property.containingType.jstype : obj);
    var curVal = target[property._fieldName];
    if (curVal !== undefined && !(force === undefined || force)) {
        return;
    }
    target[property._fieldName] = val;
    // TODO
    // target.meta.pendingInit(property, false);
    if (val instanceof Array) {
        val = new ObservableList(obj, val);
        property.changed.subscribe(function (sender, args) {
            console.log(arguments);
            /*
            var changes = args.get_changes();

            // Don't raise the change event unless there is actually a change to the collection
            if (changes && changes.some(function (change) { return (change.newItems && change.newItems.length > 0) || (change.oldItems && change.oldItems.length > 0); })) {
                // NOTE: property change should be broadcast before rules are run so that if
                // any rule causes a roundtrip to the server these changes will be available
                // TODO
                // property.containingType.model.notifyListChanged(target, property, changes);

                // NOTE: oldValue is not currently implemented for lists
                // TODO
                // property._raiseEvent("changed", [target, { property: property, newValue: val, oldValue: undefined, changes: changes, collectionChanged: true }]);

                // TODO
                // Observer.raisePropertyChanged(target, property._name);
            }
            */
        });
        // Override the default toString on arrays so that we get a comma-delimited list
        // TODO
        // val.toString = Property$_arrayToString.bind(val);
    }
    // TODO
    // Observer.raisePropertyChanged(target, property._name);
}
function ensurePropertyInited(obj, property) {
    // Determine if the property has been initialized with a value
    // and initialize the property if necessary
    if (!obj.hasOwnProperty(property._fieldName)) {
        // Do not initialize calculated properties. Calculated properties should be initialized using a property get rule.  
        // TODO
        // if (!property.isCalculated) {
        initializeProperty(obj, property, getDefaultValue(property.isList, property.jstype));
        // }
        // TODO
        // Mark the property as pending initialization
        // obj.meta.pendingInit(property, true);
    }
}
function getPropertyValue(property, obj) {
    // Ensure that the property has an initial (possibly default) value
    ensurePropertyInited(obj, property);
    /*
    // Raise get events
    var getEvent = property._getEventHandler("get");
    if (getEvent && !getEvent.isEmpty()) {
        getEvent(obj, { property: property, value: obj[property._fieldName] });
    }
    */
    // Return the property value
    return obj[property._fieldName];
}
function setPropertyValue(property, obj, val, skipTypeCheck, additionalArgs) {
    if (skipTypeCheck === void 0) { skipTypeCheck = false; }
    if (additionalArgs === void 0) { additionalArgs = null; }
    // Ensure that the property has an initial (possibly default) value
    ensurePropertyInited(obj, property);
    if (!property.canSetValue(obj, val)) {
        throw new Error("Cannot set " + property.name + "=" + (val === undefined ? "<undefined>" : val) + " for instance " + obj.meta.type.fullName + "|" + obj.meta.id + ": a value of type " + (property.jstype && property.jstype.meta ? property.jstype.meta.get_fullName() : parseFunctionName(property.jstype)) + " was expected.");
    }
    var old = obj[property._fieldName];
    // Update lists as batch remove/add operations
    if (property.isList) {
        // TODO
        // old.beginUpdate();
        // update(old, val);
        // old.endUpdate();
        throw new Error("Property set on lists is not permitted");
    }
    else {
        // compare values so that this check is accurate for primitives
        var oldValue = (old === undefined || old === null) ? old : old.valueOf();
        var newValue = (val === undefined || val === null) ? val : val.valueOf();
        // Do nothing if the new value is the same as the old value. Account for NaN numbers, which are
        // not equivalent (even to themselves). Although isNaN returns true for non-Number values, we won't
        // get this far for Number properties unless the value is actually of type Number (a number or NaN).
        if (oldValue !== newValue && !(property.jstype === Number && isNaN(oldValue) && isNaN(newValue))) {
            // Set the backing field value
            obj[property._fieldName] = val;
            // TODO
            // obj.meta.pendingInit(property, false);
            // Do not raise change if the property has not been initialized. 
            if (old !== undefined) {
                var eventArgs = { property: property, newValue: val, oldValue: old };
                if (additionalArgs) {
                    for (var arg in additionalArgs) {
                        if (additionalArgs.hasOwnProperty(arg)) {
                            eventArgs[arg] = additionalArgs[arg];
                        }
                    }
                }
                property._changedEvent.dispatch(obj, eventArgs);
            }
        }
    }
}
function makePropertyGetter(property, getter, skipTypeCheck) {
    if (skipTypeCheck === void 0) { skipTypeCheck = false; }
    return function () {
        // ensure the property is initialized
        var result = getter(property, this, skipTypeCheck);
        /*
        // TODO
        // ensure the property is initialized
        if (result === undefined || (property.isList && LazyLoader.isRegistered(result))) {
            throw new Error(
                `Property ${property.containingType.fullName}.${} is not initialized.  Make sure instances are loaded before accessing property values.  ${}|${}`);
                ,
                property.name,
                this.meta.type.fullName(),
                this.meta.id
            ));
        }
        */
        // return the result
        return result;
    };
}
function makePropertySetter(prop, setter, skipTypeCheck) {
    // TODO
    // setter.__notifies = true;
    if (skipTypeCheck === void 0) { skipTypeCheck = false; }
    return function (val) {
        setter(prop, this, val, skipTypeCheck);
    };
}

var Property = /** @class */ (function () {
    function Property(containingType, name, jstype, isList, isStatic) {
        this.containingType = containingType;
        this.name = name;
        this.jstype = jstype;
        this.isList = isList === true;
        this.isStatic = isStatic === true;
        this._changedEvent = new dist_1$1();
        this._fieldName = "_" + name;
        if (containingType.originForNewProperties) {
            this._origin = containingType.originForNewProperties;
        }
        /*
        if (this._origin === "client" && this._isPersisted) {
            // TODO
            // logWarning($format("Client-origin properties should not be marked as persisted: Type = {0}, Name = {1}", containingType.get_fullName(), name));
            console.warn(`Client-origin properties should not be marked as persisted: Type = ${containingType.fullName}, Name = ${name}`);
        }
        */
    }
    Object.defineProperty(Property.prototype, "changed", {
        get: function () {
            return this._changedEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Property.prototype.equals = function (prop) {
        if (prop !== undefined && prop !== null) {
            if (prop instanceof Property) {
                return this === prop;
            }
            // else if (prop instanceof PropertyChain) {
            // 	var props = prop.all();
            // 	return props.length === 1 && this.equals(props[0]);
            // }
        }
    };
    Property.prototype.toString = function () {
        if (this.isStatic) {
            return this.getPath();
        }
        else {
            return "this<" + this.containingType + ">." + this.name;
        }
    };
    Property.prototype.isDefinedBy = function (mtype) {
        return this.containingType === mtype || mtype.isSubclassOf(this.containingType);
    };
    Object.defineProperty(Property.prototype, "origin", {
        /*
        get_defaultValue() {
            // clone array and date defaults since they are mutable javascript types
            return this._defaultValue instanceof Array ? this._defaultValue.slice() :
                this._defaultValue instanceof Date ? new Date(+this._defaultValue) :
                    this._defaultValue instanceof TimeSpan ? new TimeSpan(this._defaultValue.totalMilliseconds) :
                        this._defaultValue instanceof Function ? this._defaultValue() :
                            this._defaultValue;
        }
        */
        get: function () {
            return this._origin ? this._origin : this.containingType.origin;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Property.prototype, "fieldName", {
        get: function () {
            return this._fieldName;
        },
        enumerable: true,
        configurable: true
    });
    Property.prototype.getPath = function () {
        return this.isStatic ? (this.containingType.fullName + "." + this.name) : this.name;
    };
    Property.prototype.canSetValue = function (obj, val) {
        // NOTE: only allow values of the correct data type to be set in the model
        if (val === undefined) {
            // TODO
            // logWarning("You should not set property values to undefined, use null instead: property = ." + this._name + ".");
            console.warn("You should not set property values to undefined, use null instead: property = " + this.name + ".");
            return true;
        }
        if (val === null) {
            return true;
        }
        // for entities check base types as well
        if (val.constructor && val.constructor.meta) {
            for (var valType = val.constructor.meta; valType; valType = valType.baseType) {
                if (valType.jstype === this.jstype) {
                    return true;
                }
            }
            return false;
        }
        //Data types
        else {
            var valObjectType = val.constructor;
            //"Normalize" data type in case it came from another frame as well as ensure that the types are the same
            switch (getTypeName(val)) {
                case "string":
                    valObjectType = String;
                    break;
                case "number":
                    valObjectType = Number;
                    break;
                case "boolean":
                    valObjectType = Boolean;
                    break;
                case "date":
                    valObjectType = Date;
                    break;
                case "array":
                    valObjectType = Array;
                    break;
            }
            // value property type check
            return valObjectType === this.jstype ||
                // entity array type check
                (valObjectType === Array && this.isList && val.every(function (child) {
                    if (child.constructor && child.constructor.meta) {
                        for (var childType = child.constructor.meta; childType; childType = childType.baseType) {
                            if (childType._jstype === this._jstype) {
                                return true;
                            }
                        }
                        return false;
                    }
                }, this));
        }
    };
    Property.prototype.value = function (obj, val, args) {
        if (args === void 0) { args = null; }
        var target = (this.isStatic ? this.containingType.jstype : obj);
        if (target === undefined || target === null) {
            throw new Error("Cannot " + (arguments.length > 1 ? "set" : "get") + " value for " + (this.isStatic ? "" : "non-") + "static property \"" + this.getPath() + "\" on type \"" + this.containingType.fullName + "\": target is null or undefined.");
        }
        if (arguments.length > 1) {
            setPropertyValue(this, target, val, false, args);
        }
        else {
            return getPropertyValue(this, target);
        }
    };
    Property.prototype.rootedPath = function (type) {
        if (this.isDefinedBy(type)) {
            return this.isStatic ? this.containingType.fullName + "." + this.name : this.name;
        }
    };
    return Property;
}());

var ObjectMeta = /** @class */ (function () {
    function ObjectMeta(type, entity) {
        this.type = type;
        this.entity = entity;
    }
    ObjectMeta.prototype.destroy = function () {
        this.type.unregister(this.entity);
    };
    return ObjectMeta;
}());

var newIdPrefix = "+c";
var disableConstruction = false;
var Type = /** @class */ (function () {
    function Type(model, name, baseType, origin) {
        this.model = model;
        this.fullName = name;
        this._initNewEvent = new dist_1$1();
        this._initExistingEvent = new dist_1$1();
        this._propertyAddedEvent = new dist_1$1();
        this._properties = {};
        // If origin is not provided it is assumed to be client
        this.origin = origin || "client";
        this.originForNewProperties = this.origin;
        this._pool = {};
        this._legacyPool = {};
        this._counter = 0;
        Object.defineProperty(this, "rules", { value: [] });
        // generate class and constructor
        var jstype = Model.getJsType(name, true);
        // create namespaces as needed
        var nameTokens = name.split("."), token = nameTokens.shift(), namespaceObj = Model._allTypesRoot, globalObj = window;
        while (nameTokens.length > 0) {
            namespaceObj = ensureNamespace(token, namespaceObj);
            globalObj = ensureNamespace(token, globalObj);
            token = nameTokens.shift();
        }
        // the final name to use is the last token
        var finalName = token;
        jstype = generateClass(this);
        this._jstype = jstype;
        // If the namespace already contains a type with this name, append a '$' to the name
        if (!namespaceObj[finalName]) {
            namespaceObj[finalName] = jstype;
        }
        else {
            namespaceObj['$' + finalName] = jstype;
        }
        // If the global object already contains a type with this name, append a '$' to the name
        if (!globalObj[finalName]) {
            globalObj[finalName] = jstype;
        }
        else {
            globalObj['$' + finalName] = jstype;
        }
        // setup inheritance
        this.derivedTypes = [];
        var baseJsType;
        if (baseType) {
            baseJsType = baseType._jstype;
            this.baseType = baseType;
            baseType.derivedTypes.push(this);
            // TODO
            // inherit all shortcut properties that have aleady been defined
            // inheritBaseTypePropShortcuts(jstype, baseType);
        }
        else {
            baseJsType = Entity;
            this.baseType = null;
        }
        disableConstruction = true;
        this._jstype.prototype = new baseJsType();
        disableConstruction = false;
        this._jstype.prototype.constructor = this._jstype;
        // helpers
        jstype.meta = this;
        // Register the type with the model
        model._types[name] = this;
        // TODO
        // Add self-reference to decrease the likelihood of errors
        // due to an absence of the necessary type vs. entity.
        // this.type = this;
    }
    Object.defineProperty(Type.prototype, "propertyAdded", {
        get: function () {
            return this._propertyAddedEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Type.prototype, "initNew", {
        get: function () {
            return this._initNewEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Type.prototype, "initExisting", {
        get: function () {
            return this._initExistingEvent.asEvent();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Type, "newIdPrefix", {
        get: function () {
            return newIdPrefix.substring(1);
        },
        set: function (value) {
            if (typeof (value) !== "string")
                throw new TypeError("Property `Type.newIdPrefix` must be a string, found <" + (typeof value) + ">");
            if (value.length === 0)
                throw new Error("Property `Type.newIdPrefix` cannot be empty string");
            newIdPrefix = "+" + value;
        },
        enumerable: true,
        configurable: true
    });
    Type.prototype.newId = function () {
        // Get the next id for this type's heirarchy.
        for (var nextId, type = this; type; type = type.baseType) {
            nextId = Math.max(nextId || 0, type._counter);
        }
        // Update the counter for each type in the heirarchy.
        for (var type = this; type; type = type.baseType) {
            type._counter = nextId + 1;
        }
        // Return the new id.
        return newIdPrefix + nextId;
    };
    Type.prototype.register = function (obj, id, suppressModelEvent) {
        if (suppressModelEvent === void 0) { suppressModelEvent = false; }
        // register is called with single argument from default constructor
        if (arguments.length === 2) {
            validateId(this, id);
        }
        obj.meta = new ObjectMeta(this, obj);
        if (!id) {
            id = this.newId();
            obj.meta.isNew = true;
        }
        var key = id.toLowerCase();
        obj.meta.id = id;
        // TODO
        // Observer.makeObservable(obj);
        for (var propertyName in this._properties) {
            var property = this._properties[propertyName];
            if (property.isStatic) {
                // for static properties add property to javascript type
                Object.defineProperty(obj, name, {
                    get: makePropertyGetter(property, getPropertyValue, true),
                    set: makePropertySetter(property, setPropertyValue, true),
                    enumerable: true,
                    configurable: false
                });
            }
            else {
                // for instance properties add member to all instances of this javascript type
                Object.defineProperty(obj, name, {
                    get: makePropertyGetter(property, getPropertyValue, true),
                    set: makePropertySetter(property, setPropertyValue, true),
                    enumerable: true,
                    configurable: false
                });
            }
        }
        for (var t = this; t; t = t.baseType) {
            if (t._pool.hasOwnProperty(key)) {
                throw new Error("Object \"" + this.fullName + "|" + id + "\" has already been registered.");
            }
            t._pool[key] = obj;
            if (t._known) {
                t._known.push(obj);
            }
        }
        if (!suppressModelEvent) {
            this.model._entityRegisteredEvent.dispatch(this.model, { entity: obj });
        }
    };
    Type.prototype.changeObjectId = function (oldId, newId) {
        validateId(this, oldId);
        validateId(this, newId);
        var oldKey = oldId.toLowerCase();
        var newKey = newId.toLowerCase();
        var obj = this._pool[oldKey];
        if (obj) {
            obj.meta._legacyId = oldId;
            for (var t = this; t; t = t.baseType) {
                t._pool[newKey] = obj;
                delete t._pool[oldKey];
                t._legacyPool[oldKey] = obj;
            }
            obj.meta.id = newId;
            return obj;
        }
        else {
            // TODO
            // logWarning($format("Attempting to change id: Instance of type \"{0}\" with id = \"{1}\" could not be found.", this.get_fullName(), oldId));
            console.warn("Attempting to change id: Instance of type \"" + this.fullName + "\" with id = \"" + oldId + "\" could not be found.");
        }
    };
    Type.prototype.unregister = function (obj) {
        for (var t = this; t; t = t.baseType) {
            delete t._pool[obj.meta.id.toLowerCase()];
            if (obj.meta._legacyId) {
                delete t._legacyPool[obj.meta._legacyId.toLowerCase()];
            }
            if (t._known) {
                t._known.remove(obj);
            }
        }
        this.model._entityUnregisteredEvent.dispatch(this.model, { entity: obj });
    };
    Type.prototype.get = function (id, exactTypeOnly) {
        var key = id.toLowerCase();
        var obj = this._pool[key] || this._legacyPool[key];
        // If exactTypeOnly is specified, don't return sub-types.
        if (obj && exactTypeOnly === true && obj.meta.type !== this) {
            throw new Error("The entity with id='" + id + "' is expected to be of type '" + this.fullName + "' but found type '" + obj.meta.type.fullName + "'.");
        }
        return obj;
    };
    // Gets an array of all objects of this type that have been registered.
    // The returned array is observable and collection changed events will be raised
    // when new objects are registered or unregistered.
    // The array is in no particular order.
    Type.prototype.known = function () {
        var known = this._known;
        if (!known) {
            var list = [];
            for (var id in this._pool) {
                list.push(this._pool[id]);
            }
            known = this._known = new ObservableList(this, list);
        }
        return known;
    };
    Object.defineProperty(Type.prototype, "jstype", {
        get: function () {
            return this._jstype;
        },
        enumerable: true,
        configurable: true
    });
    Type.prototype.addProperty = function (name, jstype, isList, isStatic) {
        /*
        // TODO
        var format = def.format;
        if (format && format.constructor === String) {
            format = getFormat(def.type, format);
        }
        */
        var property = new Property(this, name, jstype, isList, isStatic);
        this._properties[name] = property;
        // TODO
        // (isStatic ? this._staticProperties : this._instanceProperties)[name] = property;
        /*
        // TODO: Make this an extension?
        // modify jstype to include functionality based on the type definition
        function genPropertyShortcut(mtype, overwrite) {
            var shortcutName = "$" + name;
            if (!(shortcutName in mtype._jstype) || overwrite) {
                mtype._jstype[shortcutName] = property;
            }

            mtype.derivedTypes.forEach(function (t) {
                genPropertyShortcut(t, false);
            });
        }
        genPropertyShortcut(this, true);
        */
        this.known().forEach(function (entity) {
            if (property.isStatic) {
                // for static properties add property to javascript type
                Object.defineProperty(entity, name, {
                    get: makePropertyGetter(property, getPropertyValue, true),
                    set: makePropertySetter(property, setPropertyValue, true),
                    enumerable: true,
                    configurable: false
                });
            }
            else {
                // for instance properties add member to all instances of this javascript type
                Object.defineProperty(entity, name, {
                    get: makePropertyGetter(property, getPropertyValue, true),
                    set: makePropertySetter(property, setPropertyValue, true),
                    enumerable: true,
                    configurable: false
                });
            }
        });
        this._propertyAddedEvent.dispatch(this, { property: property });
        return property;
    };
    Type.prototype.property = function (name) {
        var prop;
        for (var t = this; t && !prop; t = t.baseType) {
            prop = t._properties[name];
            if (prop) {
                return prop;
            }
        }
        return null;
    };
    Type.prototype.isSubclassOf = function (mtype) {
        var result = false;
        navigateAttribute(this, 'baseType', function (baseType) {
            if (baseType === mtype) {
                result = true;
                return false;
            }
        });
        return result;
    };
    Type.prototype.toString = function () {
        return this.fullName;
    };
    return Type;
}());
function validateId(type, id) {
    if (id === null || id === undefined) {
        throw new Error("Id cannot be " + (id === null ? "null" : "undefined") + " (entity = " + type.fullName + ").");
    }
    else if (getTypeName(id) !== "string") {
        throw new Error("Id must be a string:  encountered id " + id + " of type \"" + parseFunctionName(id.constructor) + "\" (entity = " + type.fullName + ").");
    }
    else if (id === "") {
        throw new Error("Id cannot be a blank string (entity = " + type.fullName + ").");
    }
}
function generateClass(type) {
    function construct(idOrProps, props, suppressModelEvent) {
        if (!disableConstruction) {
            if (idOrProps && idOrProps.constructor === String) {
                var id = idOrProps;
                // When a constructor is called we do not want to silently
                // return an instance of a sub type, so fetch using exact type.
                var exactTypeOnly = true;
                // TODO: Indicate that an object is currently being constructed?
                var obj = type.get(id, exactTypeOnly);
                // If the instance already exists, then initialize properties and return it.
                if (obj) {
                    if (props) {
                        obj.init(props);
                    }
                    return obj;
                }
                // Register the newly constructed existing instance.
                type.register(this, id, suppressModelEvent);
                // Initialize properties if provided.
                if (props) {
                    this.init(props);
                }
                // Raise the initExisting event on this type and all base types
                for (var t = type; t; t = t.baseType) {
                    t._initExistingEvent.dispatch(t, { entity: this });
                }
            }
            else {
                // Register the newly constructed new instance. It will
                // be assigned a sequential client-generated id.
                type.register(this, null, suppressModelEvent);
                // Set properties passed into constructor.
                if (idOrProps) {
                    this.set(idOrProps);
                }
                // Raise the initNew event on this type and all base types
                for (var t = type; t; t = t.baseType) {
                    t._initNewEvent.dispatch(t, { entity: this });
                }
            }
        }
    }
    return construct;
}

exports.Type = Type;
exports.Model = Model;
