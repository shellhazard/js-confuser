"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _assert = require("assert");
var _order = require("../order");
var _probability = require("../probability");
var _template = _interopRequireDefault(require("../templates/template"));
var _gen = require("../util/gen");
var _insert = require("../util/insert");
var _random = require("../util/random");
var _transform = _interopRequireDefault(require("./transform"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var Hash = function (s) {
  var a = 1,
    c = 0,
    h,
    o;
  if (s) {
    a = 0;
    for (h = s.length - 1; h >= 0; h--) {
      o = s.charCodeAt(h);
      a = (a << 6 & 268435455) + o + (o << 14);
      c = a & 266338304;
      a = c !== 0 ? a ^ c >> 21 : a;
    }
  }
  return ~~String(a).slice(0, 3);
};
var HashTemplate = (0, _template.default)(`
  var {name} = function(arr) {
    var s = arr.map(x=>x+"").join(''), a = 1, c = 0, h, o;
    if (s) {
        a = 0;
        for (h = s.length - 1; h >= 0; h--) {
            o = s.charCodeAt(h);
            a = (a<<6&268435455) + o + (o<<14);
            c = a & 266338304;
            a = c!==0?a^c>>21:a;
        }
    }
    return ~~String(a).slice(0, 3);
};`);

/**
 * Shuffles arrays initial order of elements.
 *
 * "Un-shuffles" the array at runtime.
 */
class Shuffle extends _transform.default {
  constructor(o) {
    super(o, _order.ObfuscateOrder.Shuffle);
    _defineProperty(this, "hashName", void 0);
  }
  match(object, parents) {
    return object.type == "ArrayExpression" && !parents.find(x => x.$dispatcherSkip);
  }
  transform(object, parents) {
    return () => {
      if (object.elements.length < 3) {
        // Min: 4 elements
        return;
      }
      function isAllowed(e) {
        return e.type == "Literal" && {
          number: 1,
          boolean: 1,
          string: 1
        }[typeof e.value];
      }

      // Only arrays with only literals
      var illegal = object.elements.find(x => !isAllowed(x));
      if (illegal) {
        return;
      }
      var mapped = object.elements.map(x => x.value);
      var mode = (0, _probability.ComputeProbabilityMap)(this.options.shuffle, x => x, mapped);
      if (mode) {
        var shift = (0, _random.getRandomInteger)(1, Math.min(60, object.elements.length * 6));
        var expr = (0, _gen.Literal)(shift);
        var name = this.getPlaceholder();
        if (mode == "hash") {
          var str = mapped.join("");
          shift = Hash(str);
          if (!this.hashName) {
            (0, _insert.prepend)(parents[parents.length - 1], HashTemplate.single({
              name: this.hashName = this.getPlaceholder()
            }));
          }
          for (var i = 0; i < shift; i++) {
            object.elements.push(object.elements.shift());
          }
          var shiftedHash = Hash(object.elements.map(x => x.value + "").join(""));
          expr = (0, _gen.BinaryExpression)("-", (0, _gen.CallExpression)((0, _gen.Identifier)(this.hashName), [(0, _gen.Identifier)(name)]), (0, _gen.Literal)(shiftedHash - shift));
        } else {
          for (var i = 0; i < shift; i++) {
            object.elements.push(object.elements.shift());
          }
        }
        var code = [];
        var iName = this.getPlaceholder();
        var inPlace = false;
        var inPlaceName;
        var inPlaceBody;
        var inPlaceIndex;
        var varDeclarator = parents[0];
        if (varDeclarator.type == "VariableDeclarator") {
          var varDec = parents[2];
          if (varDec.type == "VariableDeclaration" && varDec.kind !== "const") {
            var body = parents[3];
            if (varDec.declarations.length == 1 && Array.isArray(body) && varDeclarator.id.type === "Identifier" && varDeclarator.init === object) {
              inPlaceIndex = body.indexOf(varDec);
              inPlaceBody = body;
              inPlace = inPlaceIndex !== -1;
              inPlaceName = varDeclarator.id.name;
            }
          }
        }
        if (mode !== "hash") {
          var varPrefix = this.getPlaceholder();
          code.push((0, _template.default)(`
            for ( var ${varPrefix}x = 16; ${varPrefix}x%4 === 0; ${varPrefix}x++) {
              var ${varPrefix}z = 0;
              ${inPlace ? `${inPlaceName} = ${name}` : name} = ${name}.concat((function(){
                ${varPrefix}z++;
                if(${varPrefix}z === 1){
                  return [];
                }

                for( var ${varPrefix}i = ${(0, _random.getRandomInteger)(5, 105)}; ${varPrefix}i; ${varPrefix}i-- ){
                  ${name}.unshift(${name}.pop());
                }
                return [];
              })());
            }
            `).single());
        }
        code.push((0, _gen.ForStatement)((0, _gen.VariableDeclaration)((0, _gen.VariableDeclarator)(iName, expr)), (0, _gen.Identifier)(iName), (0, _gen.UpdateExpression)("--", (0, _gen.Identifier)(iName), false), [
        // ${name}.unshift(${name}.pop());
        (0, _gen.ExpressionStatement)((0, _gen.CallExpression)((0, _gen.MemberExpression)((0, _gen.Identifier)(name), (0, _gen.Identifier)("unshift"), false), [(0, _gen.CallExpression)((0, _gen.MemberExpression)((0, _gen.Identifier)(name), (0, _gen.Identifier)("pop"), false), [])]))]));
        if (inPlace) {
          var varDeclarator = parents[0];
          (0, _assert.ok)(i != -1);
          inPlaceBody.splice(inPlaceIndex + 1, 0, (0, _gen.VariableDeclaration)((0, _gen.VariableDeclarator)(name, (0, _gen.Identifier)(varDeclarator.id.name))), ...code);
        }
        if (!inPlace) {
          this.replace(object, (0, _gen.CallExpression)((0, _gen.FunctionExpression)([(0, _gen.Identifier)(name)], [...code, (0, _gen.ReturnStatement)((0, _gen.Identifier)(name))]), [(0, _insert.clone)(object)]));
        }
      }
    };
  }
}
exports.default = Shuffle;