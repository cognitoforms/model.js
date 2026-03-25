# Entity Construction / Initialization Performance Notes

This document summarizes how entity construction currently works, what is most likely to be expensive when creating thousands of entities, and which optimizations are most likely to produce meaningful wins.

It is based on code inspection plus a small local benchmark run against the current codebase. The benchmark is only directional, but it was useful for separating constructor overhead from rule/initialization overhead.

## Scope

Relevant implementation points:

- `src/model.ts`
- `src/type.ts`
- `src/entity.ts`
- `src/property.ts`
- `src/rule.ts`
- `src/initilization-context.ts`
- `src/entity-serializer.ts`
- `src/event-scope.ts`

## High-level construction flow

### Model/type setup

- `Model.extend()` creates types first, then extends them, and uses `prepare()` / `ready()` to defer path resolution and rule registration until the model is ready.
- `Type$generateConstructor()` creates a named JS constructor for each model type and wires prototype inheritance dynamically.
- Property/rule setup is largely front-loaded during model creation, not entity creation.

### Entity creation

For a new entity:

1. The generated constructor enters `Entity` through `Type$generateConstructor()`.
2. `Entity` allocates:
   - `meta`
   - `__fields__`
   - `__pendingInit__`
   - per-instance `accessed` / `changed` events
   - an `initialized` promise
3. `Type.register()` puts the entity into the type pool and optionally creates own properties.
4. If state was supplied for a new entity, `updateWithContext()` / `update()` applies it.
5. `initNew` is raised for the type and each base type.
6. Rules and property access triggered during `onInit` may lazily initialize additional properties.

For an existing entity:

1. `Entity.init()` resolves and initializes the supplied state directly.
2. Unspecified properties are still passed through the serializer/deserializer so converters can participate.
3. `initExisting` is raised afterward.

## Important architectural observations

### 1) Construction itself is not the main cost

The constructor path does a fair amount of work, but the basic path is not especially expensive:

- generated constructor wrapper
- `ctorDepth` bookkeeping
- entity registration
- promise allocation for `initialized`

That cost exists for every entity, but the larger slowdowns seem to come from the work triggered _after_ construction, especially once `onInit` rules start touching many properties.

### 2) New-entity initialization is intentionally lazy

`Property$ensureInited()` is central here:

- properties are not eagerly initialized up front
- first access initializes the default/constant value
- `init()` functions are executed only when the property is actually forced
- calculated/default rules may leave a property in `pendingInit`

This is a useful tradeoff for normal interactive usage because unused properties stay cheap. It also means some optimization ideas that make creation more eager could accidentally regress the common case.

### 3) `onInit` often turns lazy work into eager work

The biggest amplification point is that `onInit` rules frequently access many properties. Once that happens:

- every touched property goes through `Property$ensureInited()`
- defaults/constants may be materialized
- `init()` functions may run
- property accessed/change events may publish
- more rules can become eligible to run

In other words, complex `onInit` logic converts a mostly cheap constructor into a cascade of property initialization and rule execution.

### 4) Nested entities multiply the same costs

`EntitySerializer.deserialize()` constructs child entities recursively for entity-typed properties and lists. Large object graphs therefore multiply:

- constructor/registration cost
- deserializer passes
- rule execution
- event publication

### 5) The rules system is flexible, but dispatch is chatty

Rule registration relies on event subscriptions:

- `initNew` / `initExisting`
- property `changed`
- property `accessed`
- `eventScope.onExit()`

This is clean and composable, but large numbers of rules increase:

- subscription counts
- closure allocations
- event publication fan-out
- repeated `canExecuteRule()` / `pendingInvocation()` checks

### 6) There is already one documented opt-in cost

`ModelSettings.createOwnProperties` is already called out in the code as having a speed cost for large object counts. That matches the design: generating own property descriptors on every instance is pure per-entity overhead.

## Directional benchmark notes

Local benchmark in this environment, creating 3,000 entities per scenario:

| Scenario | Avg time |
| --- | ---: |
| Flat entity, 20 props, no rules | ~32 ms |
| Flat entity, 20 props, one `onInit` rule touching all props | ~77 ms |
| Flat entity, 20 props, `init()` functions on props + one `onInit` rule touching all props | ~226 ms |
| Flat entity, 20 props, `createOwnProperties: true` + one `onInit` rule | ~90 ms |
| Nested graph + `onInit` summary rule | ~268 ms |

Additional rule fan-out comparison:

| Scenario | Avg time |
| --- | ---: |
| One `onInit` rule touching 20 props | ~81 ms |
| Twenty `onInit` rules touching one prop each | ~89 ms |
| Twenty property `set` handlers | ~100 ms |

### What these numbers suggest

- Base construction is relatively cheap.
- Touching many properties during initialization is a much bigger multiplier than the constructor itself.
- Property `init()` functions are especially expensive when `onInit` forces them all to run.
- Nested graphs are expensive mostly because they repeat the full pipeline many times.
- Many small `onInit` rules are somewhat worse than a coalesced rule, but not by an order of magnitude.
- `createOwnProperties` is a real cost, but it does not appear to be the dominant issue unless enabled in a hot path.

## Likely highest-impact opportunities

These are ordered by probable impact, not by implementation ease.

### 1) Add a true bulk-hydration path

**Why it likely matters**

For large imports or server-loaded graphs, the current new-entity path still behaves like interactive object creation: it routes through update semantics, rule/event wiring, and per-property initialization behavior. That is valuable for correctness, but expensive for bulk creation.

An opt-in bulk path could:

- assign provided values directly to `__fields__`
- avoid property accessed/change notifications during hydration
- defer or skip `onInit` execution until an explicit later phase
- optionally skip validation/default logic for already-complete state

**Why this is likely a big win**

This would avoid the largest multipliers rather than shaving small amounts off each one.

**Ramifications**

- Semantics would differ from normal `create()`/`createSync()`.
- Some models rely on `onInit`, property `set`, default rules, or converters for correctness.
- This must be explicit/opt-in, probably with narrow guarantees such as “trusted complete state only”.

### 2) Give callers a way to suppress or defer `onInit` during bulk creation

**Why it likely matters**

The benchmark strongly suggests that `onInit` is one of the major escalation points. If thousands of entities are created only to be normalized later, `onInit` can front-load a lot of work that may not be immediately needed.

Possible shapes:

- construct without firing `initNew` rules
- queue `initNew` and run once after the full graph is present
- expose an explicit `runInitRules()` phase

**Ramifications**

- Some existing logic may depend on `onInit` completing before consumers touch the entity.
- Delaying `onInit` changes visibility/timing of calculated/defaulted values.
- If adopted, this should be a separate API, not a silent change to current behavior.

### 3) Optimize for “provided state is already complete”

There is a notable distinction between:

- creating a blank/new entity that needs defaults/rules to shape it
- constructing a fully populated object graph coming from storage or an API

Today those paths still converge on a lot of common machinery. An optimization that detects “all settable properties were supplied” could reduce:

- `pendingInit` churn
- unspecified-property deserializer passes
- avoidable default/initializer work

**Ramifications**

- Must be careful with aliases/converters and any rule that intentionally depends on a property being “unspecified”.

### 4) Reduce rule dispatch overhead for initialization-heavy models

The current event-based rule dispatch is elegant, but expensive in aggregate. A more specialized init path could help:

- precompute per-type arrays of init rules
- run them directly instead of via generic event publication
- reduce closure/event object churn during initialization

This is more invasive than the options above, but it could improve both new and existing entity initialization without changing public behavior.

**Ramifications**

- Higher implementation complexity
- Must preserve ordering and inheritance behavior of `initNew` / `initExisting`
- Must preserve event-scope semantics and reentrancy protections

## Medium-impact opportunities

### 5) Avoid sorting when it is unnecessary

`Entity.getSortedPropertyData()` sorts supplied property entries so entity values initialize before non-entity values. That makes sense, but it is paid on every multi-property `init()` / `update()`.

Possible fast path:

- if there are 0-1 entries, skip sorting
- if no supplied values are entities, skip sorting

This is probably worth something, but it is unlikely to compete with the rule/property work above.

### 6) Reduce repeated name/property resolution

Each set/init path resolves a state key through `serializer.resolveProperty()`, which then may consult aliases and type lookup.

Possible improvement:

- cache a normalized state-key-to-property lookup per type

This may help when hydrating many objects with the same shape, but again it feels secondary to rule execution and property initialization.

### 7) Revisit `InitializationContext` queue/task overhead

`InitializationContext` uses:

- a `Set<Promise>`
- marker promises for `execute()`
- waiting callback arrays

This is not obviously the biggest cost, but it is on every create/update path and may become meaningful at large scales.

Possible improvement:

- replace the marker-promise pattern with a counter/state flag for synchronous sections

This is a micro-optimization unless profiling shows `InitializationContext` hot in real workloads.

## Low-priority / likely small wins

These may help, but they do not look like the place to start:

- shaving `ctorDepth` bookkeeping
- minor constructor-generation tweaks
- small object allocation reductions in `Entity`
- optimizing `pendingInvocation()` storage
- trying to eagerly initialize everything up front

Those are either too small, or they risk making common/lightweight scenarios worse.

## Guidance for model authors right now

Even without runtime changes, consumers can probably improve throughput by:

1. **Keeping `createOwnProperties` off** for bulk scenarios.
2. **Reducing `onInit` breadth**, especially rules that touch many rarely-used properties.
3. **Coalescing related init rules** when practical instead of many tiny rules.
4. **Avoiding property `init()` functions on many fields** unless those values are truly needed immediately.
5. **Avoiding eager traversal of nested graphs** during initialization unless required.

## Recommended implementation order if this is pursued

If we decide to optimize this area, the likely best order is:

1. **Profile with real workloads** to confirm the same rule/property patterns dominate.
2. **Prototype an opt-in bulk-hydration / deferred-init API**.
3. **Measure whether suppressing/defering `onInit` yields the expected win**.
4. **Only then consider deeper engine work** like specialized init-rule dispatch or property-resolution fast paths.

That sequence has the best chance of producing a large gain without destabilizing the existing model semantics.
