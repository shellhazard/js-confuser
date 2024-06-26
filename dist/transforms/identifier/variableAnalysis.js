"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _assert = require("assert");
var _constants = require("../../constants");
var _compare = require("../../util/compare");
var _identifiers = require("../../util/identifiers");
var _insert = require("../../util/insert");
var _transform = _interopRequireDefault(require("../transform"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Keeps track of what identifiers are defined and referenced in each context.
 */
class VariableAnalysis extends _transform.default {
  constructor(o) {
    super(o);
    /**
     * Node being the context.
     */
    _defineProperty(this, "defined", void 0);
    /**
     * Context->Nodes referenced (does not include nested)
     */
    _defineProperty(this, "references", void 0);
    /**
     * Set of global identifiers to never be redefined
     *
     * - Used to not accidentally block access to a global variable
     */
    _defineProperty(this, "globals", void 0);
    /**
     * Set of identifiers that are defined within the program
     */
    _defineProperty(this, "notGlobals", void 0);
    this.defined = new Map();
    this.references = new Map();
    this.globals = new Set();
    this.notGlobals = new Set();
  }
  match(object, parents) {
    return object.type === "Identifier";
  }
  transform(object, parents) {
    var name = object.name;
    (0, _assert.ok)(typeof name === "string");
    if (!(0, _compare.isValidIdentifier)(name)) {
      return;
    }
    if (_constants.reservedIdentifiers.has(name)) {
      return;
    }
    if (this.options.globalVariables.has(name)) {
      return;
    }
    var info = (0, _identifiers.getIdentifierInfo)(object, parents);
    if (!info.spec.isReferenced) {
      return;
    }
    if (info.spec.isExported) {
      return;
    }
    var isDefined = info.spec.isDefined;

    // Keep track of defined names within the program
    if (isDefined) {
      this.notGlobals.add(object.name);
      this.globals.delete(object.name);
    } else if (!this.notGlobals.has(object.name)) {
      this.globals.add(object.name);
    }
    var definingContexts = info.spec.isDefined ? (0, _insert.getAllDefiningContexts)(object, parents) : (0, _insert.getReferencingContexts)(object, parents, info);
    (0, _assert.ok)(definingContexts.length);
    definingContexts.forEach(definingContext => {
      // ok(
      //   isContext(definingContext),
      //   `${definingContext.type} is not a context`
      // );

      if (isDefined) {
        // Add to defined Map
        if (!this.defined.has(definingContext)) {
          this.defined.set(definingContext, new Set());
        }
        this.defined.get(definingContext).add(name);
        this.references.has(definingContext) && this.references.get(definingContext).delete(name);
      } else {
        // Add to references Map
        if (!this.defined.has(definingContext) || !this.defined.get(definingContext).has(name)) {
          if (!this.references.has(definingContext)) {
            this.references.set(definingContext, new Set());
          }
          this.references.get(definingContext).add(name);
        }
      }
    });
  }
}
exports.default = VariableAnalysis;