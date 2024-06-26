"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _traverse = _interopRequireDefault(require("../traverse"));
var _gen = require("../util/gen");
var _random = require("../util/random");
var _assert = require("assert");
var _obfuscator = _interopRequireDefault(require("../obfuscator"));
var _probability = require("../probability");
var _constants = require("../constants");
var _order = require("../order");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Base-class for all transformations.
 * - Transformations can have preparation transformations `.before`
 * - Transformations can have cleanup transformations `.after`
 *
 * - `match()` function returns true/false if possible candidate
 * - `transform()` function modifies the object
 *
 * ```js
 * class Example extends Transform {
 *   constructor(o){
 *     super(o);
 *   }
 *
 *   match(object, parents){
 *     return object.type == "...";
 *   }
 *
 *   transform(object, parents){
 *     // onEnter
 *
 *     return ()=>{
 *       // onExit
 *     }
 *   }
 *
 *   apply(tree){
 *     // onStart
 *
 *     super.apply(tree);
 *
 *     // onEnd
 *   }
 * }
 * ```
 */
class Transform {
  constructor(obfuscator) {
    let priority = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
    /**
     * The obfuscator.
     */
    _defineProperty(this, "obfuscator", void 0);
    /**
     * The user's options.
     */
    _defineProperty(this, "options", void 0);
    /**
     * Only required for top-level transformations.
     */
    _defineProperty(this, "priority", void 0);
    /**
     * Transforms to run before, such as `Variable Analysis`.
     */
    _defineProperty(this, "before", void 0);
    /**
     * Transforms to run after.
     */
    _defineProperty(this, "after", void 0);
    (0, _assert.ok)(obfuscator instanceof _obfuscator.default, "obfuscator should be an Obfuscator");
    this.obfuscator = obfuscator;
    this.options = this.obfuscator.options;
    this.priority = priority;
    this.before = [];
    this.after = [];
  }

  /**
   * The transformation name.
   */
  get className() {
    return _order.ObfuscateOrder[this.priority] || this.__proto__.constructor.name;
  }

  /**
   * Run an AST through the transformation (including `pre` and `post` transforms)
   * @param tree
   */
  apply(tree) {
    if (tree.type == "Program" && this.options.verbose) {
      if (this.priority === -1) {
        console.log("#", ">", this.className);
      } else {
        console.log("#", this.priority, this.className);
      }
    }

    /**
     * Run through pre-transformations
     */
    this.before.forEach(x => x.apply(tree));

    /**
     * Run this transformation
     */
    (0, _traverse.default)(tree, (object, parents) => {
      return this.input(object, parents);
    });

    /**
     * Cleanup transformations
     */
    this.after.forEach(x => x.apply(tree));
  }

  /**
   * The `match` function filters for possible candidates.
   *
   * - If `true`, the node is sent to the `transform()` method
   * - else it's discarded.
   *
   * @param object
   * @param parents
   * @param block
   */
  match(object, parents) {
    throw new Error("not implemented");
  }

  /**
   * Modifies the given node.
   *
   * - Return a function to be ran when the node is exited.
   * - The node is safe to modify in most cases.
   *
   * @param object - Current node
   * @param parents - Array of ancestors `[Closest, ..., Root]`
   * @param block
   */
  transform(object, parents) {
    throw new Error("not implemented");
  }

  /**
   * Calls `.match` with the given parameters, and then `.transform` if satisfied.
   * @private
   */
  input(object, parents) {
    if (this.match(object, parents)) {
      return this.transform(object, parents);
    }
  }

  /**
   * Returns a random string.
   *
   * Used for creating temporary variables names, typically before RenameVariables has ran.
   *
   * These long temp names will be converted to short, mangled names by RenameVariables.
   */
  getPlaceholder() {
    const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 10).toString(10)).join("");
    return _constants.placeholderVariablePrefix + genRanHex(10);
  }

  /**
   * Returns an independent name generator with it's own counter.
   * @param overrideMode - Override the user's `identifierGenerator` option
   * @returns
   */
  getGenerator(overrideMode) {
    var count = 0;
    var identifiers = new Set();
    return {
      generate: () => {
        var retValue;
        do {
          count++;
          retValue = this.generateIdentifier(-1, count, overrideMode);
        } while (identifiers.has(retValue));
        identifiers.add(retValue);
        return retValue;
      }
    };
  }

  /**
   * Generates a valid variable name.
   * @param length Default length is 6 to 10 characters.
   * @returns **`string`**
   */
  generateIdentifier() {
    let length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : -1;
    let count = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
    let overrideMode = arguments.length > 2 ? arguments[2] : undefined;
    if (length == -1) {
      length = (0, _random.getRandomInteger)(6, 8);
    }
    var set = new Set();
    if (count == -1) {
      this.obfuscator.varCount++;
      count = this.obfuscator.varCount;
      set = this.obfuscator.generated;
    }
    var identifier;
    do {
      identifier = (0, _probability.ComputeProbabilityMap)(overrideMode || this.options.identifierGenerator, function () {
        let mode = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "randomized";
        switch (mode) {
          case "randomized":
            var characters = "_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
            var numbers = "0123456789".split("");
            var combined = [...characters, ...numbers];
            var result = "";
            for (var i = 0; i < length; i++) {
              result += (0, _random.choice)(i == 0 ? characters : combined);
            }
            return result;
          case "hexadecimal":
            const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
            return "_0x" + genRanHex(length).toUpperCase();
          case "mangled":
            while (1) {
              var result = (0, _random.alphabeticalGenerator)(count);
              count++;
              if (_constants.reservedKeywords.has(result) || _constants.reservedIdentifiers.has(result)) {} else {
                return result;
              }
            }
            throw new Error("impossible but TypeScript insists");
          case "number":
            return "var_" + count;
          case "zeroWidth":
            var keyWords = ["if", "in", "for", "let", "new", "try", "var", "case", "else", "null", "break", "catch", "class", "const", "super", "throw", "while", "yield", "delete", "export", "import", "public", "return", "switch", "default", "finally", "private", "continue", "debugger", "function", "arguments", "protected", "instanceof", "function", "await", "async"];
            var safe = "\u200C".repeat(count + 1);
            var base = (0, _random.choice)(keyWords) + safe;
            return base;
        }
        throw new Error("Invalid 'identifierGenerator' mode: " + mode);
      });
    } while (set.has(identifier));
    if (!identifier) {
      throw new Error("identifier null");
    }
    set.add(identifier);
    return identifier;
  }

  /**
   * Smartly appends a comment to a Node.
   * - Includes the transformation's name.
   * @param node
   * @param text
   * @param i
   */
  addComment(node, text) {
    if (this.options.debugComments) {
      return (0, _gen.AddComment)(node, `[${this.className}] ${text}`);
    }
    return node;
  }
  replace(node1, node2) {
    for (var key in node1) {
      delete node1[key];
    }
    this.objectAssign(node1, node2);
  }
  replaceIdentifierOrLiteral(node1, node2, parents) {
    // Fix 2. Make parent property key computed
    if (parents[0] && (parents[0].type == "Property" || parents[0].type == "MethodDefinition") && parents[0].key == node1) {
      parents[0].computed = true;
      parents[0].shorthand = false;
    }
    this.replace(node1, node2);
  }

  /**
   * Smartly merges two Nodes.
   * - Null checking
   * - Preserves comments
   * @param node1
   * @param node2
   */
  objectAssign(node1, node2) {
    (0, _assert.ok)(node1);
    (0, _assert.ok)(node2);
    var comments1 = node1.leadingComments || [];
    var comments2 = node2.leadingComments || [];
    var comments = [...comments1, ...comments2];
    node2.leadingComments = comments;
    node1._transform = node2._transform = this.className;
    return Object.assign(node1, node2);
  }

  /**
   * Verbose logging for this transformation.
   * @param messages
   */
  log() {
    if (this.options.verbose) {
      for (var _len = arguments.length, messages = new Array(_len), _key = 0; _key < _len; _key++) {
        messages[_key] = arguments[_key];
      }
      console.log("[" + this.className + "]", ...messages);
    }
  }

  /**
   * Verbose logging for warning/important messages.
   * @param messages
   */
  warn() {
    if (this.options.verbose) {
      for (var _len2 = arguments.length, messages = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        messages[_key2] = arguments[_key2];
      }
      console.log("[ WARN " + this.className + " ]", ...messages);
    }
  }

  /**
   * Throws an error. Appends the transformation's name to the error's message.
   * @param error
   */
  error(error) {
    throw new Error(`${this.className} Error: ${error.message}`);
  }
}
exports.default = Transform;