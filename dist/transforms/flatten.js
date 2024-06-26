"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _assert = require("assert");
var _constants = require("../constants");
var _order = require("../order");
var _traverse = require("../traverse");
var _gen = require("../util/gen");
var _identifiers = require("../util/identifiers");
var _insert = require("../util/insert");
var _random = require("../util/random");
var _transform = _interopRequireDefault(require("./transform"));
var _functionLength = require("../templates/functionLength");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Flatten takes functions and isolates them from their original scope, and brings it to the top level of the program.
 *
 * An additional `flatObject` parameter is passed in, giving access to the original scoped variables.
 *
 * The `flatObject` uses `get` and `set` properties to allow easy an AST transformation:
 *
 * ```js
 * // Input
 * function myFunction(myParam){
 *    modified = true;
 *    if(reference) {
 *
 *    }
 *    ...
 *    console.log(myParam);
 * }
 *
 * // Output
 * function myFunction_flat([myParam], flatObject){
 *    flatObject["set_modified"] = true;
 *    if(flatObject["get_reference"]) {
 *
 *    }
 *    ...
 *    console.log(myParam)
 * }
 *
 * function myFunction(){
 *    var flatObject = {
 *        set set_modified(v) { modified = v }
 *        get get_reference() { return reference }
 *    }
 *    return myFunction_flat([...arguments], flatObject)
 * }
 * ```
 *
 * Flatten is used to make functions eligible for the RGF transformation.
 *
 * - `myFunction_flat` is now eligible because it does not rely on outside scoped variables
 */
class Flatten extends _transform.default {
  constructor(o) {
    super(o, _order.ObfuscateOrder.Flatten);
    _defineProperty(this, "isDebug", false);
    _defineProperty(this, "definedNames", void 0);
    // Array of FunctionDeclaration nodes
    _defineProperty(this, "flattenedFns", void 0);
    _defineProperty(this, "gen", void 0);
    _defineProperty(this, "functionLengthName", void 0);
    this.definedNames = new Map();
    this.flattenedFns = [];
    this.gen = this.getGenerator("mangled");
    if (this.isDebug) {
      console.warn("Flatten debug mode");
    }
  }
  apply(tree) {
    super.apply(tree);
    if (this.flattenedFns.length) {
      (0, _insert.prepend)(tree, ...this.flattenedFns);
    }
  }
  match(object, parents) {
    return (object.type == "FunctionDeclaration" || object.type === "FunctionExpression") && object.body.type == "BlockStatement" && !object.$requiresEval && !object.generator && !object.params.find(x => x.type !== "Identifier");
  }
  transform(object, parents) {
    return () => {
      var _object$id, _parents$, _parents$0$id, _parents$0$id2, _parents$2, _parents$3;
      if (parents[0]) {
        // Don't change class methods
        if (parents[0].type === "MethodDefinition" && parents[0].value === object) {
          return;
        }

        // Don't change getter/setter methods
        if (parents[0].type === "Property" && parents[0].value === object && (parents[0].kind !== "init" || parents[0].method)) {
          return;
        }
      }
      (0, _assert.ok)(object.type === "FunctionDeclaration" || object.type === "FunctionExpression");

      // The name is purely for debugging purposes
      var currentFnName = object.type === "FunctionDeclaration" ? (_object$id = object.id) === null || _object$id === void 0 ? void 0 : _object$id.name : ((_parents$ = parents[0]) === null || _parents$ === void 0 ? void 0 : _parents$.type) === "VariableDeclarator" && ((_parents$0$id = parents[0].id) === null || _parents$0$id === void 0 ? void 0 : _parents$0$id.type) === "Identifier" && ((_parents$0$id2 = parents[0].id) === null || _parents$0$id2 === void 0 ? void 0 : _parents$0$id2.name);
      if (((_parents$2 = parents[0]) === null || _parents$2 === void 0 ? void 0 : _parents$2.type) === "Property" && (_parents$3 = parents[0]) !== null && _parents$3 !== void 0 && _parents$3.key) {
        var _parents$4, _parents$4$key;
        currentFnName = currentFnName || String((_parents$4 = parents[0]) === null || _parents$4 === void 0 ? void 0 : (_parents$4$key = _parents$4.key) === null || _parents$4$key === void 0 ? void 0 : _parents$4$key.name);
      }
      if (!currentFnName) currentFnName = "unnamed";
      var definedMap = new Map();
      var illegal = new Set();
      var isIllegal = false;
      var identifierNodes = [];
      (0, _traverse.walk)(object, parents, (o, p) => {
        if (o.type === "Identifier" && o.name === "arguments" || o.type === "UnaryExpression" && o.operator === "delete" || o.type == "ThisExpression" || o.type == "Super" || o.type == "MetaProperty") {
          isIllegal = true;
          return "EXIT";
        }
        if (o.type == "Identifier" && o !== object.id && !this.options.globalVariables.has(o.name) && !_constants.reservedIdentifiers.has(o.name)) {
          var info = (0, _identifiers.getIdentifierInfo)(o, p);
          if (!info.spec.isReferenced) {
            return;
          }
          if (info.spec.isExported || o.name.startsWith(_constants.noRenameVariablePrefix)) {
            illegal.add(o.name);
            return;
          }
          if (info.spec.isDefined) {
            var definingContext = (0, _insert.getDefiningContext)(o, p);
            if (!definedMap.has(definingContext)) {
              definedMap.set(definingContext, new Set([o.name]));
            } else {
              definedMap.get(definingContext).add(o.name);
            }
            return;
          }
          var isDefined = p.find(x => definedMap.has(x) && definedMap.get(x).has(o.name));
          if (!isDefined) {
            identifierNodes.push([o, p, info]);
          }
        }
        if (o.type == "TryStatement") {
          isIllegal = true;
          return "EXIT";
        }
      });
      if (isIllegal) {
        return;
      }
      if (illegal.size) {
        return;
      }
      var newFnName = this.getPlaceholder() + "_flat_" + currentFnName;
      var flatObjectName = this.getPlaceholder() + "_flat_object";
      const getFlatObjectMember = propertyName => {
        return (0, _gen.MemberExpression)((0, _gen.Identifier)(flatObjectName), (0, _gen.Literal)(propertyName), true);
      };
      var getterPropNames = Object.create(null);
      var setterPropNames = Object.create(null);
      var typeofPropNames = Object.create(null);
      var callPropNames = Object.create(null);
      for (var [o, p, info] of identifierNodes) {
        var identifierName = o.name;
        if (p.find(x => definedMap.has(x) && definedMap.get(x).has(identifierName))) continue;
        (0, _assert.ok)(!info.spec.isDefined);
        var type = info.spec.isModified ? "setter" : "getter";
        switch (type) {
          case "setter":
            var setterPropName = setterPropNames[identifierName];
            if (typeof setterPropName === "undefined") {
              // No getter function made yet, make it (Try to re-use getter name if available)
              setterPropName = getterPropNames[identifierName] || (this.isDebug ? "set_" + identifierName : this.gen.generate());
              setterPropNames[identifierName] = setterPropName;
            }

            // If an update expression, ensure a getter function is also available. Ex: a++
            if (p[0].type === "UpdateExpression") {
              getterPropNames[identifierName] = setterPropName;
            } else {
              // If assignment on member expression, ensure a getter function is also available: Ex. myObject.property = ...
              var assignmentIndex = p.findIndex(x => x.type === "AssignmentExpression");
              if (assignmentIndex !== -1 && p[assignmentIndex].left.type !== "Identifier") {
                getterPropNames[identifierName] = setterPropName;
              }
            }

            // calls flatObject.set_identifier_value(newValue)
            this.replace(o, getFlatObjectMember(setterPropName));
            break;
          case "getter":
            var getterPropName = getterPropNames[identifierName];
            if (typeof getterPropName === "undefined") {
              // No getter function made yet, make it (Try to re-use setter name if available)
              getterPropName = setterPropNames[identifierName] || (this.isDebug ? "get_" + identifierName : this.gen.generate());
              getterPropNames[identifierName] = getterPropName;
            }

            // Typeof expression check
            if (p[0].type === "UnaryExpression" && p[0].operator === "typeof" && p[0].argument === o) {
              var typeofPropName = typeofPropNames[identifierName];
              if (typeof typeofPropName === "undefined") {
                // No typeof getter function made yet, make it (Don't re-use getter/setter names)
                typeofPropName = this.isDebug ? "get_typeof_" + identifierName : this.gen.generate();
                typeofPropNames[identifierName] = typeofPropName;
              }

              // Replace the entire unary expression not just the identifier node
              // calls flatObject.get_typeof_identifier()
              this.replace(p[0], getFlatObjectMember(typeofPropName));
              break;
            }

            // Bound call-expression check
            if (p[0].type === "CallExpression" && p[0].callee === o) {
              var callPropName = callPropNames[identifierName];
              if (typeof callPropName === "undefined") {
                callPropName = this.isDebug ? "call_" + identifierName : this.gen.generate();
                callPropNames[identifierName] = callPropName;
              }

              // Replace the entire call expression not just the identifier node
              // calls flatObject.call_identifier(...arguments)
              this.replace(p[0], (0, _gen.CallExpression)(getFlatObjectMember(callPropName), p[0].arguments));
              break;
            }

            // calls flatObject.get_identifier_value()
            this.replace(o, getFlatObjectMember(getterPropName));
            break;
        }
      }

      // Create the getter and setter functions
      var flatObjectProperties = [];

      // Getter functions
      for (var identifierName in getterPropNames) {
        var getterPropName = getterPropNames[identifierName];
        flatObjectProperties.push((0, _gen.Property)((0, _gen.Literal)(getterPropName), (0, _gen.FunctionExpression)([], [(0, _gen.ReturnStatement)((0, _gen.Identifier)(identifierName))]), true, "get"));
      }

      // Get typeof functions
      for (var identifierName in typeofPropNames) {
        var typeofPropName = typeofPropNames[identifierName];
        flatObjectProperties.push((0, _gen.Property)((0, _gen.Literal)(typeofPropName), (0, _gen.FunctionExpression)([], [(0, _gen.ReturnStatement)((0, _gen.UnaryExpression)("typeof", (0, _gen.Identifier)(identifierName)))]), true, "get"));
      }

      // Call functions
      for (var identifierName in callPropNames) {
        var callPropName = callPropNames[identifierName];
        var argumentsName = this.getPlaceholder();
        flatObjectProperties.push((0, _gen.Property)((0, _gen.Literal)(callPropName), (0, _gen.FunctionExpression)([(0, _gen.RestElement)((0, _gen.Identifier)(argumentsName))], [(0, _gen.ReturnStatement)((0, _gen.CallExpression)((0, _gen.Identifier)(identifierName), [(0, _gen.SpreadElement)((0, _gen.Identifier)(argumentsName))]))]), true));
      }

      // Setter functions
      for (var identifierName in setterPropNames) {
        var setterPropName = setterPropNames[identifierName];
        var newValueParameterName = this.getPlaceholder();
        flatObjectProperties.push((0, _gen.Property)((0, _gen.Literal)(setterPropName), (0, _gen.FunctionExpression)([(0, _gen.Identifier)(newValueParameterName)], [(0, _gen.ExpressionStatement)((0, _gen.AssignmentExpression)("=", (0, _gen.Identifier)(identifierName), (0, _gen.Identifier)(newValueParameterName)))]), true, "set"));
      }
      if (!this.isDebug) {
        (0, _random.shuffle)(flatObjectProperties);
      }
      var newBody = (0, _insert.getBlockBody)(object.body);

      // Remove 'use strict' directive
      if (newBody.length > 0 && newBody[0].directive) {
        newBody.shift();
      }
      var newFunctionDeclaration = (0, _gen.FunctionDeclaration)(newFnName, [(0, _gen.ArrayPattern)((0, _insert.clone)(object.params)), (0, _gen.Identifier)(flatObjectName)], newBody);
      newFunctionDeclaration.async = !!object.async;
      newFunctionDeclaration.generator = false;
      this.flattenedFns.push(newFunctionDeclaration);
      var argumentsName = this.getPlaceholder();

      // newFn.call([...arguments], flatObject)
      var callExpression = (0, _gen.CallExpression)((0, _gen.Identifier)(newFnName), [(0, _gen.Identifier)(argumentsName), (0, _gen.Identifier)(flatObjectName)]);
      var newObjectBody = [
      // var flatObject = { get(), set() };
      (0, _gen.VariableDeclaration)([(0, _gen.VariableDeclarator)(flatObjectName, (0, _gen.ObjectExpression)(flatObjectProperties))]), (0, _gen.ReturnStatement)(newFunctionDeclaration.async ? (0, _gen.AwaitExpression)(callExpression) : callExpression)];
      object.body = (0, _gen.BlockStatement)(newObjectBody);

      // Preserve function.length property
      var originalFunctionLength = (0, _insert.computeFunctionLength)(object.params);
      object.params = [(0, _gen.SpreadElement)((0, _gen.Identifier)(argumentsName))];
      if (originalFunctionLength !== 0) {
        if (!this.functionLengthName) {
          this.functionLengthName = this.getPlaceholder();
          (0, _insert.prepend)(parents[parents.length - 1] || object, _functionLength.FunctionLengthTemplate.single({
            name: this.functionLengthName
          }));
        }
        if (object.type === "FunctionDeclaration") {
          var body = parents[0];
          if (Array.isArray(body)) {
            var index = body.indexOf(object);
            body.splice(index + 1, 0, (0, _gen.ExpressionStatement)((0, _gen.CallExpression)((0, _gen.Identifier)(this.functionLengthName), [(0, _gen.Identifier)(object.id.name), (0, _gen.Literal)(originalFunctionLength)])));
          }
        } else {
          (0, _assert.ok)(object.type === "FunctionExpression");
          this.replace(object, (0, _gen.CallExpression)((0, _gen.Identifier)(this.functionLengthName), [{
            ...object
          }, (0, _gen.Literal)(originalFunctionLength)]));
        }
      }
    };
  }
}
exports.default = Flatten;