# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [0.3.5] - 2019-11-22
### Added
- Add support for type-level rule/method

## [0.3.4] - 2019-11-21
### Fixed
- Allow properties of type 'Object'

## [0.3.3] - 2019-09-27
### Added
- Add `labelIsFormat` and `helptextIsFormat` getters for properties

## [0.3.2] - 2019-09-26
### Fixed
- Ensure ConditionTargets are constructed after obtaining all target properties
- Use targetType when resolving rule dependencies
- Redefine items args not properly handled by babel
- Fix bug where synchronous entity initialization called set() asynchronously
- Fix bug where constant values for properties could be initialized before type dependencies
- Fix bug where newValue was not included in EntityChangedEventArgs when rule predicates change in certain cases
### Added
- Use utility method alternative to Object.entries
- Add support for serializing a specific property of an entity, optionally forcing an output even if a converter ignores the property.
- Add support for specifying a custom condition type code for property errors
- Add support for specifying additional predicates to a ValidationRule
- Add support for additional ValidationRule predicates in a property error definition
- Add support for specifying a resource to use as property error message

## [0.3.1] - 2019-09-17
### Added
- Support token value post processing when calling `Entity.toString()`

## [0.2.0] - 2019-09-13
### Fixed
- Remove babel polyfilling

## [0.1.1] - 2019-09-13
### Added
- Added repository info to package

## [0.1.0] - 2019-09-13
### Added
- Published first initial version `0.1.0`
