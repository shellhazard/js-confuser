"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.containsLexicallyBoundVariables = containsLexicallyBoundVariables;
exports.getDefiningIdentifier = getDefiningIdentifier;
exports.getFunctionParameters = getFunctionParameters;
exports.getIdentifierInfo = getIdentifierInfo;
exports.isFunctionParameter = isFunctionParameter;
exports.validateChain = validateChain;
var _assert = require("assert");
var _traverse = require("../traverse");
var _insert = require("./insert");
/**
 * Ensures the chain (object and parents) are connected.
 * @param object
 * @param parents
 */
function validateChain(object, parents) {
  if (!Array.isArray(parents)) {
    throw new Error("parents need to be an array");
  }
  if (!object) {
    throw new Error("object must be a node (not null)");
  }
  if (parents.length > 0) {
    if (object == parents[0]) {
      throw new Error("parent overlap");
    }
    if (!Object.values(parents[0]).includes(object)) {
      console.log("parents=", parents);
      console.log("object=", object);
      throw new Error("parents[0] is not connected to object");
    }
  }
}
function objectPatternCheck(object, parents) {
  var objectPatternIndex = parents.findIndex(x => x.type === "ObjectPattern");
  if (objectPatternIndex == -1) {
    return true;
  }
  var property = parents[objectPatternIndex].properties.find(property => parents[objectPatternIndex - 2] === property);
  if (property.key === (parents[objectPatternIndex - 3] || object)) {
    return false;
  }
  return true;
}

/**
 * Returns detailed information about the given Identifier node.
 * @param object
 * @param parents
 */
function getIdentifierInfo(object, parents) {
  if (object.type != "Identifier") {
    console.log(object);
    throw new Error("object is not an Identifier, its a type=" + object.type);
  }
  var parent = parents[0] || {};
  var isAccessor = parent.type == "MemberExpression" && parent.object != object && parent.property === object && !parent.computed;
  var propIndex = parents.findIndex(x => x.type == "Property" || x.type == "MethodDefinition");
  var isPropertyKey = propIndex != -1 && parents[propIndex].key == (parents[propIndex - 1] || object) && !parents[propIndex].computed;
  var objectPatternIndex = parents.findIndex(x => x.type == "ObjectPattern");
  if (objectPatternIndex !== -1 && parents[objectPatternIndex].properties == parents[objectPatternIndex - 1]) {
    if (objectPatternIndex - propIndex == 2) {
      if (parents[propIndex].value === (parents[propIndex - 1] || object)) {
        isPropertyKey = false;
      }
    }
  }
  var varIndex = parents.findIndex(x => x.type == "VariableDeclarator");
  var isVariableDeclaration = varIndex != -1 && parents[varIndex].id == (parents[varIndex - 1] || object) && parents.find(x => x.type == "VariableDeclaration") && objectPatternCheck(object, parents);
  var functionIndex = parents.findIndex(x => (0, _insert.isFunction)(x));

  // Assignment pattern check!
  if (isVariableDeclaration) {
    var slicedParents = parents.slice(0, functionIndex != -1 ? Math.min(varIndex, functionIndex) : varIndex);
    var i = 0;
    for (var parent of slicedParents) {
      var childNode = slicedParents[i - 1] || object;
      if (parent.type === "AssignmentPattern" && parent.right === childNode) {
        isVariableDeclaration = false;
        break;
      }
      i++;
    }
  }
  var forIndex = parents.findIndex(x => x.type == "ForStatement");
  var isForInitializer = forIndex != -1 && parents[forIndex].init == (parents[forIndex - 1] || object);
  var isFunctionDeclaration = functionIndex != -1 && parents[functionIndex].type == "FunctionDeclaration" && parents[functionIndex].id == object;
  var isNamedFunctionExpression = functionIndex != -1 && parents[functionIndex].type === "FunctionExpression" && parents[functionIndex].id === object;
  var isAFunctionParameter = isFunctionParameter(object, parents);
  var isClauseParameter = false;

  // Special case for Catch clauses
  var clauseIndex = parents.findIndex(x => x.type == "CatchClause");
  if (clauseIndex != -1) {
    if (parents[clauseIndex].param == (parents[clauseIndex - 1] || object)) {
      isClauseParameter = true;
    }
  }
  var isImportSpecifier = (parent.type == "ImportDefaultSpecifier" || parent.type == "ImportSpecifier") && parent.local == object;
  var isFunctionCall = parent.callee == object; // NewExpression and CallExpression

  var assignmentIndex = parents.findIndex(p => p.type === "AssignmentExpression");
  var isAssignmentLeft = assignmentIndex !== -1 && parents[assignmentIndex].left === (parents[assignmentIndex - 1] || object) && objectPatternCheck(object, parents);
  var isAssignmentValue = assignmentIndex !== -1 && parents[assignmentIndex].right === (parents[assignmentIndex - 1] || object);
  var isUpdateExpression = parent.type == "UpdateExpression";
  var isClassDeclaration = (parent.type == "ClassDeclaration" || parent.type == "ClassExpression") && parent.id == object;
  var isMethodDefinition = parent.type == "MethodDefinition" && parent.key == object && !parent.computed;
  var isMetaProperty = parent.type == "MetaProperty";
  var isLabel = parent.type == "LabeledStatement" && parent.label == object;

  // Fix 1: Labels are properly identified
  if (parent.type == "BreakStatement" || parent.type == "ContinueStatement") {
    if (parent.label == object) {
      isLabel = true;
    }
  }
  var isDeleteExpression = false;
  var deleteIndex = parents.findIndex(x => x.type == "UnaryExpression" && x.operator == "delete");
  if (deleteIndex != -1) {
    isDeleteExpression = true;
  }
  var isReferenced = !isAccessor && !isPropertyKey && !isMetaProperty && !isLabel && !object.name.startsWith("0") && !object.name.startsWith("'");
  return {
    /**
     * MemberExpression: `parent.identifier`
     */
    isAccessor,
    /**
     * Property: `{identifier: ...}`
     */
    isPropertyKey,
    /**
     * `var identifier = ...`
     */
    isVariableDeclaration,
    /**
     * `function identifier(){...}`
     */
    isFunctionDeclaration,
    /**
     * `function a(identifier){...}`
     */
    isFunctionParameter: isAFunctionParameter,
    /**
     * ```js
     * try ... catch ( identifier ) {
     *  ...
     * }
     * ```
     */
    isClauseParameter,
    /**
     * CallExpression: `identifier()`
     */
    isFunctionCall,
    /**
     * AssignmentExpression: `identifier = ...`
     */
    isAssignmentLeft,
    /**
     * AssignmentExpression (right): `x = identifier`
     */
    isAssignmentValue,
    /**
     * UpdateExpression: `identifier++`
     */
    isUpdateExpression,
    /**
     * ClassDeclaration `class identifier {...}`
     */
    isClassDeclaration,
    /**
     * Method Definition inside a class body
     * ```js
     * class Rectangle {
     *     identifier(){...}
     *
     *     get identifier(){...}
     * }
     * ```
     */
    isMethodDefinition,
    /**
     * `new.target` or `yield.input`
     */
    isMetaProperty,
    /**
     * LabelStatement: `identifier: for ( var i...)`
     */
    isLabel,
    /**
     * ```js
     * for (var i=0; ...) {
     *  ...
     * }
     * ```
     */
    isForInitializer,
    /**
     * ```js
     * import identifier from "...";
     * import {key as identifier} from "...";
     * ```
     */
    isImportSpecifier,
    /**
     * ```js
     * delete identifier[identifier]
     * ```
     */
    isDeleteExpression: isDeleteExpression,
    spec: {
      /**
       * - `export function identifier()...`
       * - `export var identifier = ...`
       */
      isExported: isVariableDeclaration && parents[3] && parents[3].type == "ExportNamedDeclaration" || isFunctionDeclaration && parents[1] && parents[1].type == "ExportNamedDeclaration",
      /**
       * Is the Identifier defined, i.e a variable declaration, function declaration, parameter, or class definition
       */
      isDefined: isVariableDeclaration || isFunctionDeclaration || isNamedFunctionExpression || isAFunctionParameter || isClassDeclaration || isClauseParameter || isMethodDefinition || isImportSpecifier,
      /**
       * Is the Identifier modified, either by an `AssignmentExpression` or `UpdateExpression`
       */
      isModified: isAssignmentLeft || isUpdateExpression || isDeleteExpression,
      /**
       * Is the Identifier referenced as a variable.
       *
       * - true: `if ( identifier ) {...}`
       * - false `if ( obj.identifier ) {...}`
       * - false `identifier: for ( var ...)`
       * - false `var {identifier: ...}`
       * - false `break identifier;`
       */
      isReferenced: isReferenced
    }
  };
}
function getDefiningIdentifier(object, parents) {
  (0, _assert.ok)(object.type == "Identifier", "must be identifier");
  (0, _assert.ok)(typeof object.name === "string");
  (0, _assert.ok)(parents[parents.length - 1].type == "Program", "root node must be type Program. Found '" + parents[parents.length - 1].type + "'");
  var seen = new Set();
  var i = 0;
  for (var parent of parents) {
    var l;
    var bestScore = Infinity;
    (0, _traverse.walk)(parent, parents.slice(i + 1), (o, p) => {
      // if (p.find((x) => seen.has(x))) {
      //   return "EXIT";
      // }

      if (o.type == "Identifier" && o.name === object.name && o !== object) {
        var info = getIdentifierInfo(o, p);
        if (info.spec.isDefined) {
          var contexts = p.filter(x => (0, _insert.isVarContext)(x));
          var definingContext = info.isFunctionDeclaration ? (0, _insert.getVarContext)(p[0], p.slice(1)) : (0, _insert.getVarContext)(o, p);
          if (parents.includes(definingContext)) {
            var index = contexts.indexOf(definingContext);
            if (index < bestScore) {
              l = [o, p];
              bestScore = index;
            }
          }
        }
      }
    });
    if (l) {
      // console.log(l[0].name, "->", l[0], bestScore);

      return l;
    }
    seen.add(parent);
    i++;
  }
}
function isFunctionParameter(o, p, c) {
  (0, _assert.ok)(o);
  (0, _assert.ok)(p);
  validateChain(o, p);
  if (o.type !== "Identifier") {
    return false;
  }
  var object = p.find(x => (0, _insert.isFunction)(x) && x.params);
  if (!object) {
    return false;
  }
  c = c || (0, _insert.getVarContext)(o, p);
  if (c === object) {
    var pIndex = p.indexOf(object.params);
    if (pIndex == -1) {
      return false;
    }
    var param = p[pIndex - 1] || o;
    var paramIndex = object.params.indexOf(param);
    (0, _assert.ok)(paramIndex !== -1);
    var sliced = p.slice(0, pIndex);
    var isReferenced = true;
    var i = 0;
    for (var node of sliced) {
      var down = sliced[i - 1] || o;
      (0, _assert.ok)(down);
      if (node.type) {
        if (node.type == "AssignmentPattern" && node.right === down) {
          isReferenced = false;
          break;
        }
        if (node.type == "Property" && node.key === down && sliced[i + 2] && sliced[i + 2].type == "ObjectPattern") {
          isReferenced = false;
          break;
        }
      }
      i++;
    }
    if (isReferenced) {
      return true;
    }
  }
  return false;
}
function getFunctionParameters(object, parents) {
  (0, _assert.ok)((0, _insert.isFunction)(object));
  (0, _assert.ok)(object.params);
  var locations = [];
  (0, _traverse.walk)(object.params, [object, ...parents], (o, p) => {
    if (o.type == "Identifier") {
      if (isFunctionParameter(o, p, object)) {
        locations.push([o, p]);
      }
    }
  });
  return locations;
}
function containsLexicallyBoundVariables(object, parents) {
  var contains = false;
  (0, _traverse.walk)(object, parents, (o, p) => {
    if (o.type == "VariableDeclaration") {
      if (o.kind === "let" || o.kind === "const") {
        // Control Flow Flattening changes the lexical block, therefore this is not possible
        // Maybe a transformation to remove let
        contains = true;
        return "EXIT";
      }
    }
    if (o.type == "ClassDeclaration") {
      contains = true;
      return "EXIT";
    }
  });
  return contains;
}