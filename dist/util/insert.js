"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.append = append;
exports.clone = clone;
exports.computeFunctionLength = computeFunctionLength;
exports.deleteDeclaration = deleteDeclaration;
exports.deleteDirect = deleteDirect;
exports.getAllDefiningContexts = getAllDefiningContexts;
exports.getBlockBody = getBlockBody;
exports.getContexts = getContexts;
exports.getDefiningContext = getDefiningContext;
exports.getFunction = getFunction;
exports.getIndexDirect = getIndexDirect;
exports.getLexContext = getLexContext;
exports.getReferencingContexts = getReferencingContexts;
exports.getVarContext = getVarContext;
exports.isContext = isContext;
exports.isForInitialize = isForInitialize;
exports.isFunction = isFunction;
exports.isLexContext = isLexContext;
exports.isVarContext = isVarContext;
exports.prepend = prepend;
var _assert = require("assert");
var _traverse = require("../traverse");
var _identifiers = require("./identifiers");
/**
 * - `FunctionDeclaration`
 * - `FunctionExpression`
 * - `ArrowFunctionExpression`
 * @param object
 * @returns
 */
function isFunction(object) {
  return ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(object && object.type);
}

/**
 * The function context where the object is.
 *
 * - Determines if async context.
 * - Determines variable context.
 *
 * @param object
 * @param parents
 */
function getFunction(object, parents) {
  return parents.find(x => isFunction(x));
}

/**
 * Refers to the current function or Root node
 * @param parents
 */
function getVarContext(object, parents) {
  var fn = getFunction(object, parents);
  if (fn) {
    return fn;
  }
  var top = parents[parents.length - 1] || object;
  if (top) {
    (0, _assert.ok)(top.type == "Program", "Root node not program, its " + top.type);
    return top;
  }
  throw new Error("Missing root node");
}

/**
 * `Function` or root node
 * @param object
 * @returns
 */
function isVarContext(object) {
  return isFunction(object) || object.type == "Program" || object.type == "DoExpression"; // Stage 1
}

/**
 * `Block` or root node
 * @param object
 * @returns
 */
function isLexContext(object) {
  return (0, _traverse.isBlock)(object) || object.type == "Program";
}

/**
 * Either a `var context` or `lex context`
 * @param object
 * @returns
 */
function isContext(object) {
  return isVarContext(object) || isLexContext(object);
}
function getContexts(object, parents) {
  return [object, ...parents].filter(x => isContext(x));
}

/**
 * Refers to the current lexical block or Root node.
 * @param parents
 */
function getLexContext(object, parents) {
  var block = (0, _traverse.getBlock)(object, parents);
  if (block) {
    return block;
  }
  var top = parents[parents.length - 1];
  if (!top) {
    throw new Error("Missing root node");
  }
}
function getDefiningContext(o, p) {
  (0, _identifiers.validateChain)(o, p);
  (0, _assert.ok)(o.type == "Identifier");
  var info = (0, _identifiers.getIdentifierInfo)(o, p);
  (0, _assert.ok)(info.spec.isDefined);
  if (info.isVariableDeclaration) {
    var variableDeclaration = p.find(x => x.type == "VariableDeclaration");
    (0, _assert.ok)(variableDeclaration);
    if (variableDeclaration.kind === "let" || variableDeclaration.kind === "const") {
      var context = getVarContext(o, p);
      if (context && context.type === "Program") {
        return getLexContext(o, p);
      }
    }
  }
  if (info.isFunctionDeclaration) {
    return getVarContext(p[0], p.slice(1));
  }
  return getVarContext(o, p);
}

/**
 * A more accurate context finding function.
 * @param o Object
 * @param p Parents
 * @returns Contexts
 */
function getAllDefiningContexts(o, p) {
  var contexts = [getDefiningContext(o, p)];
  var info = (0, _identifiers.getIdentifierInfo)(o, p);
  if (info.isFunctionParameter) {
    // Get Function
    var fn = getFunction(o, p);

    // contexts.push(fn.body);
  }
  if (info.isClauseParameter) {
    var catchClause = p.find(x => x.type === "CatchClause");
    if (catchClause) {
      return [catchClause];
    }
  }
  return contexts;
}
function getReferencingContexts(o, p, info) {
  (0, _identifiers.validateChain)(o, p);
  (0, _assert.ok)(o.type == "Identifier");
  if (!info) {
    info = (0, _identifiers.getIdentifierInfo)(o, p);
  }
  (0, _assert.ok)(info.spec.isReferenced);
  return [getVarContext(o, p), getLexContext(o, p)];
}
function getBlockBody(block) {
  if (!block) {
    throw new Error("no block body");
  }
  if (Array.isArray(block)) {
    return block;
  }
  return getBlockBody(block.body);
}
function getIndexDirect(object, parent) {
  return Object.keys(parent).find(x => parent[x] == object);
}

/**
 * Attempts to a delete a variable/functions declaration.
 * @param object
 * @param parents
 */
function deleteDeclaration(object, parents) {
  (0, _identifiers.validateChain)(object, parents);

  // variables
  var list = [object, ...parents];
  var declaratorIndex = list.findIndex(x => x.type == "VariableDeclarator");
  if (declaratorIndex != -1) {
    var declarator = list[declaratorIndex]; // {type: VariableDeclarator, id: Identifier, init: Literal|Expression...}
    var declarations = list[declaratorIndex + 1]; // declarator[]
    var VariableDeclaration = list[declaratorIndex + 2];
    var body = list[declaratorIndex + 3];
    deleteDirect(declarator, declarations);
    if (VariableDeclaration.declarations.length == 0) {
      deleteDirect(VariableDeclaration, body);
    }
  } else {
    if (object.type != "FunctionDeclaration") {
      throw new Error("No method to delete: " + object.type);
    }
    deleteDirect(object, parents[0]);
  }
}

/**
 * Object must be directly nested in parent
 */
function deleteDirect(object, parent) {
  if (!object) {
    throw new Error("object undefined");
  }
  if (!parent) {
    throw new Error("parent undefined");
  }
  (0, _identifiers.validateChain)(object, [parent]);
  if (typeof parent === "object") {
    if (Array.isArray(parent)) {
      var index = parent.indexOf(object);
      if (index != -1) {
        // delete
        parent.splice(index, 1);
      } else {
        console.log("parent=", parent);
        console.log("object=", object);
        throw new Error("index -1");
      }
    } else {
      var keyName = Object.keys(parent).find(x => parent[x] == object);
      if (keyName) {
        delete parent[keyName];
      } else {
        throw new Error("keyName undefined");
      }
    }
  }
}
function prepend(block) {
  (0, _assert.ok)(!Array.isArray(block), "block should not be array");
  for (var _len = arguments.length, nodes = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    nodes[_key - 1] = arguments[_key];
  }
  if (block.type == "Program") {
    var moveBy = 0;
    block.body.forEach((stmt, i) => {
      if (stmt.type == "ImportDeclaration") {
        if (moveBy == i) {
          moveBy++;
        }
      }
      if (stmt.type === "ExpressionStatement" && typeof stmt.directive === "string") {
        if (moveBy == i) {
          moveBy++;
        }
      }
    });
    block.body.splice(moveBy, 0, ...nodes);
  } else if (block.type === "SwitchCase") {
    block.consequent.unshift(...nodes);
  } else {
    var bodyArray = getBlockBody(block);

    // Check for 'use strict'
    if (bodyArray[0] && bodyArray[0].directive) {
      // Insert under 'use strict' directive
      bodyArray.splice(1, 0, ...nodes);
    } else {
      // Prepend at the top of the block
      bodyArray.unshift(...nodes);
    }
  }
}
function append(block) {
  (0, _assert.ok)(!Array.isArray(block), "block should not be array");
  for (var _len2 = arguments.length, nodes = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    nodes[_key2 - 1] = arguments[_key2];
  }
  getBlockBody(block).push(...nodes);
}
function clone(object) {
  if (typeof object === "object" && object) {
    if (Array.isArray(object)) {
      var newArray = [];
      object.forEach(element => {
        newArray.push(clone(element));
      });
      return newArray;
    } else {
      var newObject = {};
      Object.keys(object).forEach(key => {
        if (!(key + "").startsWith("$")) {
          newObject[key] = clone(object[key]);
        }
      });
      return newObject;
    }
  }
  return object;
}

/**
 * | Return Value | Description |
 * | --- | --- |
 * | `"initializer"` | For-statement initializer (`.init`) |
 * | `"left-hand"` | For-In/Of-statement left-hand (`.left`) |
 * | `false` | None of the above |
 *
 * Determines if given node is a for-loop initializer.
 *
 * @param o
 * @param p
 * @returns
 */
function isForInitialize(o, p) {
  (0, _identifiers.validateChain)(o, p);
  var forIndex = p.findIndex(x => x.type == "ForStatement" || x.type == "ForInStatement" || x.type == "ForOfStatement");
  if (p.slice(0, forIndex).find(x => ["ArrowFunctionExpression", "BlockStatement"].includes(x.type))) {
    return false;
  }
  if (forIndex !== -1) {
    if (p[forIndex].type == "ForStatement") {
      if (p[forIndex].init == (p[forIndex - 1] || o)) {
        return "initializer";
      }
    } else {
      if (p[forIndex].left == (p[forIndex - 1] || o)) {
        return "left-hand";
      }
    }
  }
  return false;
}

/**
 * Computes the `function.length` property given the parameter nodes.
 *
 * @param params
 * @returns
 */
function computeFunctionLength(params) {
  var count = 0;
  for (var parameterNode of params) {
    if (parameterNode.type === "Identifier" || parameterNode.type === "ObjectPattern" || parameterNode.type === "ArrayPattern") {
      count++;
    } else {
      break;
    }
  }
  return count;
}