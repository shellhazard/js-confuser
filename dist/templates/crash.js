"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CrashTemplate3 = exports.CrashTemplate2 = exports.CrashTemplate1 = void 0;
var _template = _interopRequireDefault(require("./template"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const CrashTemplate1 = exports.CrashTemplate1 = (0, _template.default)(`
var {var} = "a";
while(1){
    {var} = {var} += "a";
}
`);
const CrashTemplate2 = exports.CrashTemplate2 = (0, _template.default)(`
while(true) {
    var {var} = 99;
    for({var} = 99; {var} == {var}; {var} *= {var}) {
        !{var} && console.log({var});
        if ({var} <= 10){
            break;
        }
    };
    if({var} === 100) {
        {var}--
    }
 };`);
const CrashTemplate3 = exports.CrashTemplate3 = (0, _template.default)(`
try {
    function {$2}(y, x){
        return x;
      }
      
      var {$1} = {$2}(this, function () {
        var {$3} = function () {
            var regExp = {$3}
                .constructor('return /" + this + "/')()
                .constructor('^([^ ]+( +[^ ]+)+)+[^ ]}');
            
            return !regExp.call({$1});
        };
        
        return {$3}();
      });
      
      {$1}();
} catch ( {$1}e ) {
    while({$1}e ? {$1}e : !{$1}e){
        var {$1}b;
        var {$1}c = 0;
        ({$1}e ? !{$1}e : {$1}e) ? (function({$1}e){
            {$1}c = {$1}e ? 0 : !{$1}e ? 1 : 0;
        })({$1}e) : {$1}b = 1;

        if({$1}b&&{$1}c){break;}
        if({$1}b){continue;}
    }
}
`);