import {QueryValidator} from "./QueryValidator";
import {Validator} from "./QueryEngine";

export class Sorter {
    private readonly solution: any[];
    private queryValidator: QueryValidator = Validator.getInstance();

    constructor(solution: any[]) {
        this.solution = solution;
    }

    public rearrangeOrder(order: any): any[] {
        if (order !== null && typeof(order) === "string") {
            let o: string = order.split("_")[1];
            if (this.queryValidator.isOneOfTheFields(o)) {
                this.simpleSortUp(order);
            }
            return this.solution;
        } else if (order !== null && this.queryValidator.validJson(order)) {
            if (order.keys.length !== 0) {
                if (order.dir === "UP") {
                    this.sortUp(order.keys);
                } else if (order.dir === "DOWN") {
                    this.sortDown(order.keys);
                }
            }
            return this.solution;
        }
        return this.solution;
    }

    private simpleSortUp(key: string) {
        this.solution.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (valA < valB) {
                return -1;
            } else if (valA > valB) {
                return 1;
            } else {
                return 0;
            }
        });
    }

    private sortUp(keyArray: string[]): void {
        this.solution.sort((a, b) => {
            for (let key of keyArray) {
                let valA = a[key];
                let valB = b[key];
                if (valA < valB) {
                    return -1;
                } else if (valA > valB) {
                    return 1;
                }
            }
            return 0;
        });
    }


    private sortDown(keyArray: string[]): void {
        this.solution.sort((a, b) => {
            for (let key of keyArray) {
                let valA = a[key];
                let valB = b[key];
                if (valA > valB) {
                    return -1;
                } else if (valA < valB) {
                    return 1;
                }
            }
            return 0;
        });
    }
}
