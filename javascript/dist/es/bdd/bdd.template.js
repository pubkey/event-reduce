import { minimalStringToSimpleBdd, resolveWithSimpleBdd } from 'binary-decision-diagram';
import { stateResolveFunctionByIndex } from '../states';
export var minimalBddString = '${minimalBddString}';
export var simpleBdd = minimalStringToSimpleBdd(minimalBddString);
export var resolveInput = function (input) { return resolveWithSimpleBdd(simpleBdd, stateResolveFunctionByIndex, input); };
//# sourceMappingURL=bdd.template.js.map