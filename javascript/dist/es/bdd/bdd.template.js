import { minimalStringToSimpleBdd, resolveWithSimpleBdd } from 'binary-decision-diagram';
import { stateResolveFunctionByIndex } from '../states';
export var minimalBddString = '${minimalBddString}';
var simpleBdd;
export function getSimpleBdd() {
    if (!simpleBdd) {
        simpleBdd = minimalStringToSimpleBdd(minimalBddString);
    }
    return simpleBdd;
}
export var resolveInput = function (input) {
    return resolveWithSimpleBdd(getSimpleBdd(), stateResolveFunctionByIndex, input);
};
//# sourceMappingURL=bdd.template.js.map