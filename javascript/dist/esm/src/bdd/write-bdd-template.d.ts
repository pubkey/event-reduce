import { PerformanceMeasurement } from '../truth-table-generator/calculate-bdd-quality.js';
export declare const BDD_TEMPLATE_LOCATION: string;
export declare const BDD_OPTIMIZE_STATE_LOCATION: string;
export declare const BDD_TEMPLATE_GOAL: string;
export declare function writeBddTemplate(minimalBddString: string, performanceMeasurement: PerformanceMeasurement, quality: number): void;
