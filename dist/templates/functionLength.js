"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FunctionLengthTemplate = void 0;
var _template = _interopRequireDefault(require("./template"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Helper function to set `function.length` property.
 */
const FunctionLengthTemplate = exports.FunctionLengthTemplate = (0, _template.default)(`
function {name}(functionObject, functionLength){
  Object["defineProperty"](functionObject, "length", {
    "value": functionLength,
    "configurable": true
  });
  return functionObject;
}
`);