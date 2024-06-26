"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _order = require("../../order");
var _template = _interopRequireDefault(require("../../templates/template"));
var _traverse = require("../../traverse");
var _gen = require("../../util/gen");
var _insert = require("../../util/insert");
var _random = require("../../util/random");
var _transform = _interopRequireDefault(require("../transform"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var DevToolsDetection = (0, _template.default)(`
  try {
    if ( setInterval ) {
      setInterval(()=>{
        {functionName}();
      }, 4000);
    }
  } catch ( e ) {

  }
`);
class AntiDebug extends _transform.default {
  constructor(o, lock) {
    super(o, _order.ObfuscateOrder.Lock);
    _defineProperty(this, "made", void 0);
    _defineProperty(this, "lock", void 0);
    this.lock = lock;
    this.made = 0;
  }
  apply(tree) {
    super.apply(tree);
    var fnName = this.getPlaceholder();
    var startTimeName = this.getPlaceholder();
    var endTimeName = this.getPlaceholder();
    var isDevName = this.getPlaceholder();
    var functionDeclaration = (0, _gen.FunctionDeclaration)(fnName, [], [...(0, _template.default)(`
      var ${startTimeName} = new Date();
      debugger;
      var ${endTimeName} = new Date();
      var ${isDevName} = ${endTimeName}-${startTimeName} > 1000;
      `).compile(), (0, _gen.IfStatement)((0, _gen.Identifier)(isDevName), this.options.lock.countermeasures ? this.lock.getCounterMeasuresCode(tree.body, [tree]) : [(0, _gen.WhileStatement)((0, _gen.Identifier)(isDevName), [(0, _gen.ExpressionStatement)((0, _gen.AssignmentExpression)("=", (0, _gen.Identifier)(startTimeName), (0, _gen.Identifier)(endTimeName)))])], null)]);
    tree.body.unshift(...DevToolsDetection.compile({
      functionName: fnName
    }));
    tree.body.push(functionDeclaration);
  }
  match(object, parents) {
    return (0, _traverse.isBlock)(object);
  }
  transform(object, parents) {
    return () => {
      var body = (0, _insert.getBlockBody)(object.body);
      [...body].forEach((stmt, i) => {
        var addDebugger = Math.random() < 0.1 / (this.made || 1);
        if (object.type == "Program" && i == 0) {
          addDebugger = true;
        }
        if (addDebugger) {
          var index = (0, _random.getRandomInteger)(0, body.length);
          if (body[index].type != "DebuggerStatement") {
            body.splice(index, 0, (0, _gen.DebuggerStatement)());
            this.made++;
          }
        }
      });
    };
  }
}
exports.default = AntiDebug;