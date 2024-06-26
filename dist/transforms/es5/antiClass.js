"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _transform = _interopRequireDefault(require("../transform"));
var _template = _interopRequireDefault(require("../../templates/template"));
var _traverse = require("../../traverse");
var _gen = require("../../util/gen");
var _assert = require("assert");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class AntiClass extends _transform.default {
  constructor(o) {
    super(o);
  }
  match(o, p) {
    return o.type == "ClassDeclaration" || o.type == "ClassExpression";
  }
  transform(object, parents) {
    return () => {
      var body = object.body;
      if (body.type !== "ClassBody") {
        return;
      }
      if (!Array.isArray(body.body)) {
        return;
      }
      var isDeclaration = object.type == "ClassDeclaration";
      var virtualName = "virtual" + this.getPlaceholder();
      var staticBody = [];
      var virtualBody = [];
      var superName;
      var thisName = "this" + this.getPlaceholder();

      // self this
      virtualBody.push((0, _template.default)(`var ${thisName} = this;`).single());
      virtualBody.push((0, _template.default)(`${thisName}["constructor"] = null;`).single());
      var superArguments;
      var superBody = [];
      if (object.superClass) {
        superName = "super" + this.getPlaceholder();
      }
      var virtualDescriptorsName = this.getPlaceholder();
      var staticDescriptorsName = this.getPlaceholder();

      // getters/setters
      virtualBody.push((0, _template.default)(`var ${virtualDescriptorsName} = {getters: {}, setters: {}}`).single());

      // getters/setters
      staticBody.push((0, _template.default)(`var ${staticDescriptorsName} = {getters: {}, setters: {}}`).single());
      body.body.forEach(methodDefinition => {
        if (!methodDefinition.key) {
          return;
        }
        var isStatic = methodDefinition.static;
        var key = (0, _gen.MemberExpression)(isStatic ? (0, _gen.Identifier)(virtualName) : (0, _gen.ThisExpression)(), methodDefinition.key, methodDefinition.computed);
        var value = methodDefinition.value;
        var pushingTo = isStatic ? staticBody : virtualBody;
        if (superName && value.type == "FunctionExpression") {
          var first = value.body.body[0];
          if (first.type == "ExpressionStatement" && first.expression.type == "CallExpression") {
            if (first.expression.callee.type == "Super") {
              superArguments = first.expression.arguments;
              value.body.body.shift();
            }
          }
          (0, _traverse.walk)(value.body, [value, methodDefinition, body.body, body, object, ...parents], (o, p) => {
            if (o.type == "Super") {
              this.replace(o, (0, _gen.Identifier)(superName));
            }
          });
        }

        // Support class fields
        if (methodDefinition.type === "PropertyDefinition") {
          var assignmentExpression = (0, _gen.AssignmentExpression)("=", key, value || (0, _gen.Identifier)("undefined"));
          pushingTo.push((0, _gen.ExpressionStatement)(assignmentExpression));
        } else if (methodDefinition.kind == "constructor" || methodDefinition.kind == "method") {
          pushingTo.push((0, _gen.ExpressionStatement)((0, _gen.AssignmentExpression)("=", key, value)));
        } else if (methodDefinition.kind == "get" || methodDefinition.kind == "set") {
          var id = (0, _gen.Identifier)(methodDefinition.kind == "get" ? "getters" : "setters");
          var type = (0, _gen.MemberExpression)((0, _gen.Identifier)(isStatic ? staticDescriptorsName : virtualDescriptorsName), id, false);
          var assignmentExpression = (0, _gen.AssignmentExpression)("=", (0, _gen.MemberExpression)(type, methodDefinition.key, methodDefinition.computed), value);
          pushingTo.push((0, _gen.ExpressionStatement)(assignmentExpression));
        } else {
          console.log(methodDefinition);
          throw new Error("Unsupported method definition");
        }
      });
      virtualBody.push((0, _template.default)(`
      [...Object.keys(${virtualDescriptorsName}.getters), ...Object.keys(${virtualDescriptorsName}.setters)].forEach(key=>{
  
        if( !${thisName}.hasOwnProperty(key) ) {
          var getter = ${virtualDescriptorsName}.getters[key];
          var setter = ${virtualDescriptorsName}.setters[key];
          Object.defineProperty(${thisName}, key, {
            get: getter,
            set: setter,
            configurable: true
          })
        }
  
      })
      
      `).single());
      staticBody.push((0, _template.default)(`
      [...Object.keys(${staticDescriptorsName}.getters), ...Object.keys(${staticDescriptorsName}.setters)].forEach(key=>{
  
        if( !${virtualName}.hasOwnProperty(key) ) {
          var getter = ${staticDescriptorsName}.getters[key];
          var setter = ${staticDescriptorsName}.setters[key];
          Object.defineProperty(${virtualName}, key, {
            get: getter,
            set: setter,
            configurable: true
          })
        }
  
      })
      
      `).single());
      if (superName) {
        (0, _assert.ok)(superArguments, "Super class with no super arguments");

        // save the super state
        virtualBody.unshift((0, _template.default)(`
            Object.keys(this).forEach(key=>{
              var descriptor = Object.getOwnPropertyDescriptor(this, key);
              if ( descriptor) {
                Object.defineProperty(${superName}, key, descriptor)
              } else {
                ${superName}[key] = this[key];
              }
            })`).single());
        virtualBody.unshift((0, _gen.ExpressionStatement)((0, _gen.CallExpression)((0, _gen.MemberExpression)(object.superClass, (0, _gen.Identifier)("call"), false), [(0, _gen.ThisExpression)(), ...superArguments])));
        virtualBody.unshift((0, _template.default)(`var ${superName} = {}`).single());
      }
      virtualBody.push((0, _template.default)(`if(!this["constructor"]){this["constructor"] = ()=>{}};`).single());
      if (object.id && object.id.name) {
        virtualBody.push((0, _template.default)(`Object.defineProperty(this["constructor"], 'name', {
          writable: true,
          configurable: true,
          value: '${object.id.name}'
        });`).single());
      }
      virtualBody.push((0, _template.default)(`this["constructor"](...arguments)`).single());
      var virtualFunction = (0, _gen.FunctionExpression)([], virtualBody);
      var completeBody = [(0, _gen.VariableDeclaration)((0, _gen.VariableDeclarator)(virtualName, virtualFunction)), ...staticBody, (0, _gen.ReturnStatement)((0, _gen.Identifier)(virtualName))];
      var expr = (0, _gen.CallExpression)((0, _gen.FunctionExpression)([], completeBody), []);
      if (isDeclaration) {
        expr = (0, _gen.VariableDeclaration)((0, _gen.VariableDeclarator)(object.id, expr));
      }
      this.replace(object, expr);
    };
  }
}
exports.default = AntiClass;