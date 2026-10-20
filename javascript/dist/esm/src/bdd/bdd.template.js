import { packedBddFromBase64String, resolveWithPackedBdd } from 'binary-decision-diagram';
import { stateResolveFunctionByIndex } from '../states/index.js';
export const packedBddString = '${packedBddString}';
let packedBdd;
export function getPackedBdd() {
    if (!packedBdd) {
        packedBdd = packedBddFromBase64String(packedBddString);
    }
    return packedBdd;
}
export const resolveInput = (input) => resolveWithPackedBdd(getPackedBdd(), stateResolveFunctionByIndex, input);
//# sourceMappingURL=bdd.template.js.map