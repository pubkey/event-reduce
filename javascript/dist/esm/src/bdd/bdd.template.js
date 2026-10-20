import { minimalStringToSimpleBdd, resolveWithSimpleBdd } from 'binary-decision-diagram';
import { stateResolveFunctionByIndex } from '../states/index.js';
export const minimalBddString = '${minimalBddString}';
let simpleBdd;
export function getSimpleBdd() {
    if (!simpleBdd) {
        simpleBdd = minimalStringToSimpleBdd(minimalBddString);
    }
    return simpleBdd;
}
export const resolveInput = (input) => {
    return resolveWithSimpleBdd(getSimpleBdd(), stateResolveFunctionByIndex, input);
};
//# sourceMappingURL=bdd.template.js.map