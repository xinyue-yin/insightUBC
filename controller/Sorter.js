"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const QueryEngine_1 = require("./QueryEngine");
class Sorter {
    constructor(solution) {
        this.queryValidator = QueryEngine_1.Validator.getInstance();
        this.solution = solution;
    }
    rearrangeOrder(order) {
        if (order !== null && typeof (order) === "string") {
            let o = order.split("_")[1];
            if (this.queryValidator.isOneOfTheFields(o)) {
                this.simpleSortUp(order);
            }
            return this.solution;
        }
        else if (order !== null && this.queryValidator.validJson(order)) {
            if (order.keys.length !== 0) {
                if (order.dir === "UP") {
                    this.sortUp(order.keys);
                }
                else if (order.dir === "DOWN") {
                    this.sortDown(order.keys);
                }
            }
            return this.solution;
        }
        return this.solution;
    }
    simpleSortUp(key) {
        this.solution.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (valA < valB) {
                return -1;
            }
            else if (valA > valB) {
                return 1;
            }
            else {
                return 0;
            }
        });
    }
    sortUp(keyArray) {
        this.solution.sort((a, b) => {
            for (let key of keyArray) {
                let valA = a[key];
                let valB = b[key];
                if (valA < valB) {
                    return -1;
                }
                else if (valA > valB) {
                    return 1;
                }
            }
            return 0;
        });
    }
    sortDown(keyArray) {
        this.solution.sort((a, b) => {
            for (let key of keyArray) {
                let valA = a[key];
                let valB = b[key];
                if (valA > valB) {
                    return -1;
                }
                else if (valA < valB) {
                    return 1;
                }
            }
            return 0;
        });
    }
}
exports.Sorter = Sorter;
//# sourceMappingURL=Sorter.js.map