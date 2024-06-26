"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _transform = _interopRequireDefault(require("../transform"));
var _template = _interopRequireDefault(require("../../templates/template"));
var _gen = require("../../util/gen");
var _insert = require("../../util/insert");
var _random = require("../../util/random");
var _assert = require("assert");
var _compiler = require("../../compiler");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Hashing Algorithm for function integrity
 * @param str
 * @param seed
 */
function cyrb53(str) {
  let seed = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// In template form to be inserted into code
const HashTemplate = (0, _template.default)(`
function {name}(str, seed) {
  var h1 = 0xdeadbeef ^ seed;
  var h2 = 0x41c6ce57 ^ seed;
  for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = {imul}(h1 ^ ch, 2654435761);
      h2 = {imul}(h2 ^ ch, 1597334677);
  }
  h1 = {imul}(h1 ^ (h1>>>16), 2246822507) ^ {imul}(h2 ^ (h2>>>13), 3266489909);
  h2 = {imul}(h2 ^ (h2>>>16), 2246822507) ^ {imul}(h1 ^ (h1>>>13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1>>>0);
};`);

// Math.imul polyfill for ES5
const ImulTemplate = (0, _template.default)(`
var {name} = Math.imul || function(opA, opB){
  opB |= 0; // ensure that opB is an integer. opA will automatically be coerced.
  // floating points give us 53 bits of precision to work with plus 1 sign bit
  // automatically handled for our convienence:
  // 1. 0x003fffff /*opA & 0x000fffff*/ * 0x7fffffff /*opB*/ = 0x1fffff7fc00001
  //    0x1fffff7fc00001 < Number.MAX_SAFE_INTEGER /*0x1fffffffffffff*/
  var result = (opA & 0x003fffff) * opB;
  // 2. We can remove an integer coersion from the statement above because:
  //    0x1fffff7fc00001 + 0xffc00000 = 0x1fffffff800001
  //    0x1fffffff800001 < Number.MAX_SAFE_INTEGER /*0x1fffffffffffff*/
  if (opA & 0xffc00000 /*!== 0*/) result += (opA & 0xffc00000) * opB |0;
  return result |0;
};`);

// Simple function that returns .toString() value with spaces replaced out
const StringTemplate = (0, _template.default)(`
  function {name}(x){
    return x.toString().replace(/ |\\n|;|,|\\{|\\}|\\(|\\)|\\.|\\[|\\]/g, "");
  }
`);

/**
 * Integrity protects functions by using checksum techniques to verify their code has not changed.
 *
 * If an attacker modifies a function, the modified function will not execute.
 *
 * How it works:
 *
 * - By using `.toString()` JavaScript will expose a function's source code.
 * - We can hash it and use an if statement in the code to ensure the function's code is unchanged.
 *
 * This is the most complicated Transformation for JSConfuser so here I'll explain:
 * - The Program is wrapped in an IIFE (Function Expression that is called instantly)
 * - Every function including ^ are generated out and evaluated for their .toString() value
 * - Hashed using cyrb53's hashing algorithm
 * - Check the checksum before running the code.
 *
 * - The hashing function is placed during this transformation,
 * - A hidden identifier is placed to keep track of the name.
 */
class Integrity extends _transform.default {
  constructor(o, lock) {
    super(o);
    _defineProperty(this, "hashFn", void 0);
    _defineProperty(this, "imulFn", void 0);
    _defineProperty(this, "stringFn", void 0);
    _defineProperty(this, "seed", void 0);
    _defineProperty(this, "lock", void 0);
    this.lock = lock;
    this.seed = (0, _random.getRandomInteger)(0, 1000);
  }
  match(object, parents) {
    // ArrowFunctions are excluded!
    return object.type == "Program" || (0, _insert.isFunction)(object) && object.type !== "ArrowFunctionExpression";
  }
  transform(object, parents) {
    if (object.type == "Program") {
      return () => {
        var hashingUtils = [];
        var imulName = this.getPlaceholder();
        var imulVariableDeclaration = ImulTemplate.single({
          name: imulName
        });
        imulVariableDeclaration.$dispatcherSkip = true;
        this.imulFn = imulVariableDeclaration._hiddenId = (0, _gen.Identifier)(imulName);
        hashingUtils.push(imulVariableDeclaration);
        var hashName = this.getPlaceholder();
        var hashFunctionDeclaration = HashTemplate.single({
          name: hashName,
          imul: imulName
        });
        this.hashFn = hashFunctionDeclaration._hiddenId = (0, _gen.Identifier)(hashName);
        hashingUtils.push(hashFunctionDeclaration);
        hashFunctionDeclaration.$dispatcherSkip = true;
        var stringName = this.getPlaceholder();
        var stringFunctionDeclaration = StringTemplate.single({
          name: stringName
        });
        this.stringFn = stringFunctionDeclaration._hiddenId = (0, _gen.Identifier)(stringName);
        hashingUtils.push(stringFunctionDeclaration);
        stringFunctionDeclaration.$dispatcherSkip = true;
        var functionExpression = (0, _gen.FunctionExpression)([], (0, _insert.clone)(object.body));
        object.body = [(0, _gen.ExpressionStatement)((0, _gen.CallExpression)(functionExpression, []))];
        object.$dispatcherSkip = true;
        object._hiddenHashingUtils = hashingUtils;
        var ok = this.transform(functionExpression, [object.body[0], object.body, object]);
        if (ok) {
          ok();
        }
        object.$eval = () => {
          if ((0, _insert.isFunction)(functionExpression) && functionExpression.body.type == "BlockStatement") {
            if (this.lock.counterMeasuresNode) {
              functionExpression.body.body.unshift((0, _insert.clone)(this.lock.counterMeasuresNode[0]));
            }
            functionExpression.body.body.unshift(...hashingUtils);
          }
        };
      };
    }
    (0, _assert.ok)((0, _insert.isFunction)(object));
    if (object.generator || object.async) {
      return;
    }
    return () => {
      object.__hiddenCountermeasures = this.lock.getCounterMeasuresCode(object, parents);
      object.$eval = () => {
        var functionName = this.generateIdentifier();
        var hashName = this.generateIdentifier();
        var functionDeclaration = {
          ...(0, _insert.clone)(object),
          type: "FunctionDeclaration",
          id: (0, _gen.Identifier)(functionName),
          params: object.params || [],
          body: object.body || (0, _gen.BlockStatement)([]),
          expression: false,
          $dispatcherSkip: true
        };
        var toString = (0, _compiler.compileJsSync)(functionDeclaration, this.options);
        if (!toString) {
          return;
        }
        var minified = toString.replace(/ |\n|;|,|\{|\}|\(|\)|\.|\[|\]/g, "");
        var hash = cyrb53(minified, this.seed);
        this.log((object.id ? object.id.name : "function") + " -> " + hash, minified);
        var ifStatement = (0, _gen.IfStatement)((0, _gen.BinaryExpression)("==", (0, _gen.Identifier)(hashName), (0, _gen.Literal)(hash)), [(0, _template.default)(`return {functionName}.apply(this, arguments)`).single({
          functionName: functionName
        })]);
        if (object.__hiddenCountermeasures && object.__hiddenCountermeasures.length) {
          ifStatement.alternate = (0, _gen.BlockStatement)(object.__hiddenCountermeasures);
        }
        object.body = (0, _gen.BlockStatement)([functionDeclaration, (0, _gen.VariableDeclaration)((0, _gen.VariableDeclarator)(hashName, (0, _gen.CallExpression)((0, _insert.clone)(this.hashFn), [(0, _gen.CallExpression)((0, _insert.clone)(this.stringFn), [(0, _gen.Identifier)(functionName)]), (0, _gen.Literal)(this.seed)]))), ifStatement]);

        // Make sure the countermeasures activation variable is present
        if (this.lock.counterMeasuresActivated) {
          object.body.body.unshift((0, _gen.VariableDeclaration)((0, _gen.VariableDeclarator)(this.lock.counterMeasuresActivated)));
        }
        if (object.type == "ArrowFunctionExpression") {
          object.type = "FunctionExpression";
          object.expression = false;
        }
      };
    };
  }
}
exports.default = Integrity;