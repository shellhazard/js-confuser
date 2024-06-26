"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _transform = _interopRequireDefault(require("../transform"));
var _traverse = require("../../traverse");
var _gen = require("../../util/gen");
var _insert = require("../../util/insert");
var _order = require("../../order");
var _identifiers = require("../../util/identifiers");
var _compare = require("../../util/compare");
var _probability = require("../../probability");
var _assert = require("assert");
var _guard = require("../../util/guard");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Extracts keys out of an object if possible.
 * ```js
 * // Input
 * var utils = {
 *   isString: x=>typeof x === "string",
 *   isBoolean: x=>typeof x === "boolean"
 * }
 * if ( utils.isString("Hello") ) {
 *   ...
 * }
 *
 * // Output
 * var utils_isString = x=>typeof x === "string";
 * var utils_isBoolean = x=>typeof x === "boolean"
 *
 * if ( utils_isString("Hello") ) {
 *   ...
 * }
 * ```
 */
class ObjectExtraction extends _transform.default {
  constructor(o) {
    super(o, _order.ObfuscateOrder.ObjectExtraction);
  }
  match(object, parents) {
    return (0, _insert.isVarContext)(object);
  }
  transform(context, contextParents) {
    // ObjectExpression Extractor

    return () => {
      // First pass through to find the maps
      var objectDefs = Object.create(null);
      var objectDefiningIdentifiers = Object.create(null);
      var illegal = new Set();
      (0, _traverse.walk)(context, contextParents, (object, parents) => {
        if (object.type == "ObjectExpression") {
          // this.log(object, parents);
          if (parents[0].type == "VariableDeclarator" && parents[0].init == object && parents[0].id.type == "Identifier") {
            var name = parents[0].id.name;
            if (name) {
              if ((0, _insert.getVarContext)(object, parents) != context) {
                illegal.add(name);
                return;
              }
              if (!object.properties.length) {
                illegal.add(name);
                return;
              }

              // duplicate name
              if (objectDefiningIdentifiers[name]) {
                illegal.add(name);
                return;
              }

              // check for computed properties
              // Change String literals to non-computed
              object.properties.forEach(prop => {
                if (prop.computed && (0, _guard.isStringLiteral)(prop.key)) {
                  prop.computed = false;
                }
              });
              var nonInitOrComputed = object.properties.find(x => x.kind !== "init" || x.computed);
              if (nonInitOrComputed) {
                if (nonInitOrComputed.key) {
                  this.log(name + " has non-init/computed property: " + nonInitOrComputed.key.name || nonInitOrComputed.key.value);
                } else {
                  this.log(name + " has spread-element or other type of property");
                }
                illegal.add(name);
                return;
              } else {
                var illegalName = object.properties.map(x => x.computed ? x.key.value : x.key.name || x.key.value).find(x => !x || !(0, _compare.isValidIdentifier)(x));
                if (illegalName) {
                  this.log(name + " has an illegal property '" + illegalName + "'");
                  illegal.add(name);
                  return;
                } else {
                  var isIllegal = false;
                  (0, _traverse.walk)(object, parents, (o, p) => {
                    if (o.type == "ThisExpression" || o.type == "Super") {
                      isIllegal = true;
                      return "EXIT";
                    }
                  });
                  if (isIllegal) {
                    illegal.add(name);
                    return;
                  }
                  objectDefs[name] = [object, parents];
                  objectDefiningIdentifiers[name] = [parents[0].id, [...parents]];
                }
              }
            }
          }
        }
      });
      illegal.forEach(name => {
        delete objectDefs[name];
        delete objectDefiningIdentifiers[name];
      });

      // this.log("object defs", objectDefs);
      // huge map of changes
      var objectDefChanges = {};
      if (Object.keys(objectDefs).length) {
        // A second pass through is only required when extracting object keys

        // Second pass through the exclude the dynamic map (counting keys, re-assigning)
        (0, _traverse.walk)(context, contextParents, (object, parents) => {
          if (object.type == "Identifier") {
            var info = (0, _identifiers.getIdentifierInfo)(object, parents);
            if (!info.spec.isReferenced) {
              return;
            }
            var def = objectDefs[object.name];
            if (def) {
              var isIllegal = false;
              if (info.spec.isDefined) {
                if (objectDefiningIdentifiers[object.name][0] !== object) {
                  this.log(object.name, "you can't redefine the object");
                  isIllegal = true;
                }
              } else {
                var isMemberExpression = parents[0].type == "MemberExpression" && parents[0].object == object;
                if (parents.find(x => x.type == "AssignmentExpression") && !isMemberExpression || parents.find(x => x.type == "UnaryExpression" && x.operator == "delete")) {
                  this.log(object.name, "you can't re-assign the object");
                  isIllegal = true;
                } else if (isMemberExpression) {
                  var key = parents[0].property.value || parents[0].property.name;
                  if (parents[0].computed && parents[0].property.type !== "Literal") {
                    this.log(object.name, "object[expr] detected, only object['key'] is allowed");
                    isIllegal = true;
                  } else if (!parents[0].computed && parents[0].property.type !== "Identifier") {
                    this.log(object.name, "object.<expr> detected, only object.key is allowed");
                    isIllegal = true;
                  } else if (!key || !def[0].properties.some(x => (x.key.value || x.key.name) == key)) {
                    // check if initialized property
                    // not in initialized object.
                    this.log(object.name, "not in initialized object.", def[0].properties, key);
                    isIllegal = true;
                  }
                  if (!isIllegal && key) {
                    // allowed.
                    // start the array if first time
                    if (!objectDefChanges[object.name]) {
                      objectDefChanges[object.name] = [];
                    }
                    // add to array
                    objectDefChanges[object.name].push({
                      key: key,
                      object: object,
                      parents: parents
                    });
                  }
                } else {
                  this.log(object.name, "you must access a property on the when referring to the identifier (accessors must be hard-coded literals), parent is " + parents[0].type);
                  isIllegal = true;
                }
              }
              if (isIllegal) {
                // this is illegal, delete it from being moved and delete accessor changes from happening
                this.log(object.name + " is illegal");
                delete objectDefs[object.name];
                delete objectDefChanges[object.name];
              }
            }
          }
        });
        Object.keys(objectDefs).forEach(name => {
          if (!(0, _probability.ComputeProbabilityMap)(this.options.objectExtraction, x => x, name)) {
            //continue;
            return;
          }
          var [object, parents] = objectDefs[name];
          var declarator = parents[0];
          var declaration = parents[2];
          (0, _assert.ok)(declarator.type === "VariableDeclarator");
          (0, _assert.ok)(declaration.type === "VariableDeclaration");
          var properties = object.properties;
          // change the prop names while extracting
          var newPropNames = {};
          var variableDeclarators = [];
          properties.forEach(property => {
            var keyName = property.key.name || property.key.value;
            var nn = name + "_" + keyName;
            newPropNames[keyName] = nn;
            var v = property.value;
            variableDeclarators.push((0, _gen.VariableDeclarator)(nn, this.addComment(v, `${name}.${keyName}`)));
          });
          declaration.declarations.splice(declaration.declarations.indexOf(declarator), 1, ...variableDeclarators);
          if (declaration.kind === "const") {
            declaration.kind = "var";
          }

          // update all identifiers that pointed to the old object
          objectDefChanges[name] && objectDefChanges[name].forEach(change => {
            if (!change.key) {
              this.error(new Error("key is undefined"));
            }
            if (newPropNames[change.key]) {
              var memberExpression = change.parents[0];
              if (memberExpression.type == "MemberExpression") {
                this.replace(memberExpression, this.addComment((0, _gen.Identifier)(newPropNames[change.key]), `Original Accessor: ${name}.${change.key}`));
              } else {
                // Provide error with more information:
                console.log(memberExpression);
                this.error(new Error(`should be MemberExpression, found type=${memberExpression.type}`));
              }
            } else {
              console.log(objectDefChanges[name], newPropNames);
              this.error(new Error(`"${change.key}" not found in [${Object.keys(newPropNames).join(", ")}] while flattening ${name}.`));
            }
          });
          this.log(`Extracted ${Object.keys(newPropNames).length} properties from ${name}, affecting ${Object.keys(objectDefChanges[name] || {}).length} line(s) of code.`);
        });
      }
    };
  }
}
exports.default = ObjectExtraction;