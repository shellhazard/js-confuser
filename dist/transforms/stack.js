"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _assert = require("assert");
var _order = require("../order");
var _probability = require("../probability");
var _template = _interopRequireDefault(require("../templates/template"));
var _traverse = require("../traverse");
var _gen = require("../util/gen");
var _identifiers = require("../util/identifiers");
var _insert = require("../util/insert");
var _random = require("../util/random");
var _transform = _interopRequireDefault(require("./transform"));
var _constants = require("../constants");
var _functionLength = require("../templates/functionLength");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
class Stack extends _transform.default {
  constructor(o) {
    super(o, _order.ObfuscateOrder.Stack);
    _defineProperty(this, "mangledExpressionsMade", void 0);
    _defineProperty(this, "functionLengthName", void 0);
    this.mangledExpressionsMade = 0;
  }
  match(object, parents) {
    return (0, _insert.isFunction)(object) && !object.params.find(x => x.type !== "Identifier") && object.body.type === "BlockStatement" && !parents.find(x => x.$dispatcherSkip) && !object.$requiresEval;
  }
  transform(object, parents) {
    var _this = this;
    return () => {
      var _getBlockBody$;
      // Uncaught SyntaxError: Getter must not have any formal parameters.
      // Uncaught SyntaxError: Setter must have exactly one formal parameter
      var propIndex = parents.findIndex(x => x.type === "Property" || x.type === "MethodDefinition");
      if (propIndex !== -1) {
        if (parents[propIndex].value === (parents[propIndex - 1] || object)) {
          if (parents[propIndex].kind !== "init" || parents[propIndex].method) {
            return;
          }
        }
      }

      // Don't apply to functions with 'use strict' directive
      if ((_getBlockBody$ = (0, _insert.getBlockBody)(object.body)[0]) !== null && _getBlockBody$ !== void 0 && _getBlockBody$.directive) {
        return;
      }
      if (!(0, _probability.ComputeProbabilityMap)(this.options.stack)) {
        return;
      }
      var defined = new Set();
      var referenced = new Set();
      var illegal = new Set();

      /**
       * Maps old names to new indices
       */
      var subscripts = new Map();
      var deadValues = Object.create(null);
      var propertyGen = this.getGenerator();
      function isTransformableFunction(functionNode) {
        if (functionNode.$requiresEval) return false;

        // Check for 'this'
        var isIllegal = false;
        (0, _traverse.walk)(functionNode.body, [], (o, p) => {
          if (o.type === "ThisExpression") {
            isIllegal = true;
            return "EXIT";
          }
        });
        return !isIllegal;
      }
      function setSubscript(string, index) {
        subscripts.set(string, index + "");
      }
      object.params.forEach(param => {
        (0, _assert.ok)(param.name);
        defined.add(param.name);
        setSubscript(param.name, subscripts.size);
      });
      var startingSize = subscripts.size;
      var isIllegal = false;
      (0, _traverse.walk)(object.body, [object, ...parents], (o, p) => {
        if (o.type === "Identifier" && o.name === "arguments") {
          isIllegal = true;
          return "EXIT";
        }
        if (o.type == "Identifier") {
          var info = (0, _identifiers.getIdentifierInfo)(o, p);
          if (!info.spec.isReferenced || info.spec.isExported) {
            return;
          }
          var c = info.spec.isDefined ? (0, _insert.getDefiningContext)(o, p) : (0, _insert.getReferencingContexts)(o, p).find(x => (0, _insert.isVarContext)(x));
          if (c !== object) {
            // this.log(o.name + " is illegal due to different context");
            illegal.add(o.name);
          }
          if (o.name.startsWith(_constants.noRenameVariablePrefix)) {
            illegal.add(o.name);
          }
          if (info.isClauseParameter || info.isFunctionParameter || (0, _insert.isForInitialize)(o, p)) {
            // this.log(
            //   o.name + " is illegal due to clause parameter/function parameter"
            // );
            illegal.add(o.name);
          }
          if (o.hidden) {
            illegal.add(o.name);
          }
          if (info.spec.isDefined) {
            if (defined.has(o.name)) {
              illegal.add(o.name);
            }
            if (info.isFunctionDeclaration) {
              (0, _assert.ok)(p[0].type === "FunctionDeclaration");
              if (p[0] !== object.body.body[0] || !isTransformableFunction(p[0])) {
                illegal.add(o.name);
              }
            }

            // The new accessors will either be numbered: [index] or as a string .string
            var newSubscript = (0, _random.choice)([subscripts.size, propertyGen.generate()]);
            setSubscript(o.name, newSubscript);
            defined.add(o.name);

            // Stack can only process single VariableDeclarations
            var varIndex = p.findIndex(x => x.type == "VariableDeclaration");
            if (varIndex !== -1) {
              // Invalid 'id' property (must be Identifier)
              if (varIndex !== 2) {
                illegal.add(o.name);
              } else if (p[varIndex].declarations.length > 1) {
                illegal.add(o.name);
              } else {
                var value = p[varIndex].declarations[0].init;
                if (value && !isTransformableFunction(value)) {
                  illegal.add(o.name);
                }
              }
            }
          } else if (info.spec.isReferenced) {
            if (info.spec.isModified) {
              var assignmentIndex = p.findIndex(x => x.type === "AssignmentExpression");
              if (assignmentIndex !== -1) {
                var value = p[assignmentIndex].right;
                if (value && !isTransformableFunction(value)) {
                  illegal.add(o.name);
                }
              }
            }
            referenced.add(o.name);
          }
        }
      });
      if (isIllegal) return;
      illegal.forEach(name => {
        defined.delete(name);
        referenced.delete(name);
        subscripts.delete(name);
      });
      referenced.forEach(name => {
        if (!defined.has(name)) {
          subscripts.delete(name);
        }
      });
      if (object.params.find(x => illegal.has(x.name))) {
        return;
      }
      if (!subscripts.size) {
        return;
      }
      const numberLiteral = function (number) {
        let depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
        (0, _assert.ok)(number === number);
        if (typeof number !== "number" || !Object.keys(deadValues).length || depth > 4 || (0, _random.chance)(75 + depth * 15 + _this.mangledExpressionsMade / 25)) {
          return (0, _gen.Literal)(number);
        }
        _this.mangledExpressionsMade++;
        var opposingIndex = (0, _random.choice)(Object.keys(deadValues));
        if (typeof opposingIndex === "undefined") {
          return (0, _gen.Literal)(number);
        }
        var actualValue = deadValues[opposingIndex];
        (0, _assert.ok)(typeof actualValue === "number");
        return (0, _gen.BinaryExpression)("-", (0, _gen.MemberExpression)((0, _gen.Identifier)(stackName), numberLiteral(isNaN(parseFloat(opposingIndex)) ? opposingIndex : parseFloat(opposingIndex), depth + 1), true), numberLiteral(actualValue - number, depth + 1));
      };
      function getMemberExpression(index) {
        (0, _assert.ok)(typeof index === "string", typeof index);
        return (0, _gen.MemberExpression)((0, _gen.Identifier)(stackName), numberLiteral(isNaN(parseFloat(index)) ? index : parseFloat(index)), true);
      }
      var stackName = this.getPlaceholder() + "_stack";
      const scan = (o, p) => {
        if (o.type == "Identifier") {
          var index = subscripts.get(o.name);
          if (typeof index !== "undefined") {
            var info = (0, _identifiers.getIdentifierInfo)(o, p);
            if (!info.spec.isReferenced) {
              return;
            }
            var member = getMemberExpression(index);
            if (info.spec.isDefined) {
              if (info.isVariableDeclaration) {
                (0, _traverse.walk)(p[2], p.slice(3), (oo, pp) => {
                  if (oo != o) {
                    return scan(oo, pp);
                  }
                });
                this.replace(p[2], (0, _gen.ExpressionStatement)((0, _gen.AssignmentExpression)("=", member, p[0].init || (0, _gen.Identifier)("undefined"))));
                return;
              } else if (info.isFunctionDeclaration) {
                (0, _traverse.walk)(p[0], p.slice(1), (oo, pp) => {
                  if (oo != o) {
                    return scan(oo, pp);
                  }
                });
                this.replace(p[0], (0, _gen.ExpressionStatement)((0, _gen.AssignmentExpression)("=", member, {
                  ...p[0],
                  type: "FunctionExpression",
                  id: null,
                  expression: false
                })));
                return;
              } else if (info.isClassDeclaration) {
                (0, _traverse.walk)(p[0], p.slice(1), (oo, pp) => {
                  if (oo != o) {
                    return scan(oo, pp);
                  }
                });
                this.replace(p[0], (0, _gen.ExpressionStatement)((0, _gen.AssignmentExpression)("=", member, {
                  ...p[0],
                  type: "ClassExpression"
                })));
                return;
              }
            }
            if (info.spec.isReferenced) {
              this.replace(o, member);
            }
          }
        }
        if (o.type == "Literal" && typeof o.value === "number" && Math.floor(o.value) === o.value && Math.abs(o.value) < 100_000 && p.find(x => (0, _insert.isFunction)(x)) === object && (0, _random.chance)(50)) {
          return () => {
            this.replaceIdentifierOrLiteral(o, numberLiteral(o.value, 0), p);
          };
        }
      };
      var rotateNodes = Object.create(null);
      object.body.body.forEach((stmt, index) => {
        var isFirst = index == 0;
        if (isFirst || (0, _random.chance)(50 - index * 10)) {
          var exprs = [];
          var changes = (0, _random.getRandomInteger)(1, 3);
          for (var i = 0; i < changes; i++) {
            var expr;
            var type = (0, _random.choice)(["set", "deadValue"]);
            var valueSet = new Set([...Array.from(subscripts.values()), ...Object.keys(deadValues)]);
            var newIndex;
            var i = 0;
            do {
              newIndex = (0, _random.choice)([propertyGen.generate(), (0, _random.getRandomInteger)(0, 250 + subscripts.size + i * 1000) + ""]);
              i++;
            } while (valueSet.has(newIndex));
            switch (type) {
              case "set":
                var randomName = (0, _random.choice)(Array.from(subscripts.keys()));
                var currentIndex = subscripts.get(randomName);
                expr = (0, _gen.AssignmentExpression)("=", getMemberExpression(newIndex), getMemberExpression(currentIndex));
                (0, _assert.ok)(typeof deadValues[newIndex] === "undefined", deadValues[newIndex]);
                setSubscript(randomName, newIndex);
                break;
              case "deadValue":
                var rand = (0, _random.getRandomInteger)(-150, 150);

                // modify an already existing dead value index
                if ((0, _random.chance)(50)) {
                  var alreadyExisting = (0, _random.choice)(Object.keys(deadValues));
                  if (typeof alreadyExisting === "string") {
                    newIndex = alreadyExisting;
                  }
                }
                expr = (0, _gen.AssignmentExpression)("=", getMemberExpression(newIndex), numberLiteral(rand));
                deadValues[newIndex] = rand;
                break;
            }
            exprs.push(expr);
          }
          rotateNodes[index] = (0, _gen.ExpressionStatement)((0, _gen.SequenceExpression)(exprs));
        }
        (0, _traverse.walk)(stmt, [object.body.body, object.body, object, ...parents], (o, p) => {
          return scan(o, p);
        });
        if (stmt.type == "ReturnStatement") {
          var opposing = (0, _random.choice)(Object.keys(deadValues));
          if (typeof opposing === "string") {
            this.replace(stmt, (0, _gen.IfStatement)((0, _gen.BinaryExpression)(">", getMemberExpression(opposing), numberLiteral(deadValues[opposing] + (0, _random.getRandomInteger)(40, 140))), [(0, _gen.ReturnStatement)(getMemberExpression((0, _random.getRandomInteger)(-250, 250) + ""))], [(0, _gen.ReturnStatement)(stmt.argument)]));
          }
        }
      });

      // Add in the rotation nodes
      Object.keys(rotateNodes).forEach((index, i) => {
        object.body.body.splice(parseInt(index) + i, 0, rotateNodes[index]);
      });

      // Preserve function.length property
      var originalFunctionLength = (0, _insert.computeFunctionLength)(object.params);

      // Set the params for this function to be the stack array
      object.params = [(0, _gen.RestElement)((0, _gen.Identifier)(stackName))];

      // Ensure the array is correct length
      (0, _insert.prepend)(object.body, (0, _template.default)(`${stackName}["length"] = ${startingSize}`).single());
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
            body.splice(index, 0, (0, _gen.ExpressionStatement)((0, _gen.CallExpression)((0, _gen.Identifier)(this.functionLengthName), [(0, _gen.Identifier)(object.id.name), (0, _gen.Literal)(originalFunctionLength)])));
          }
        } else {
          (0, _assert.ok)(object.type === "FunctionExpression" || object.type === "ArrowFunctionExpression");
          this.replace(object, (0, _gen.CallExpression)((0, _gen.Identifier)(this.functionLengthName), [{
            ...object
          }, (0, _gen.Literal)(originalFunctionLength)]));
        }
      }
    };
  }
}
exports.default = Stack;