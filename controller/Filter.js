"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IInsightFacade_1 = require("./IInsightFacade");
const QueryEngine_1 = require("./QueryEngine");
class Filter {
    constructor(id) {
        this.datasetId = id;
        this.queryValidator = QueryEngine_1.Validator.getInstance();
        this.datasetKind = this.queryValidator.getDatasetKind();
    }
    filterSolution(object, filter, solution) {
        let result = [];
        if (!this.queryValidator.validJson(object)) {
            throw new IInsightFacade_1.InsightError("Invalid object in " + filter);
        }
        switch (filter) {
            case "LT":
            case "GT":
            case "EQ":
                result = this.mComparator(object, filter, solution);
                break;
            case "IS":
                result = this.sComparator(object, filter, solution);
                break;
            case "AND":
            case "OR":
                result = this.lComparator(object, filter, solution);
                break;
            case "NOT":
                result = this.neg(object, filter, solution);
                break;
            default:
                throw new IInsightFacade_1.InsightError("Invalid Filter");
        }
        return result;
    }
    mComparator(object, filter, previousResult) {
        let keys = Object.keys(object);
        let value = Object.values(object)[0];
        let result = [];
        if (keys.length !== 1) {
            throw new IInsightFacade_1.InsightError("Excess keys in FILTER");
        }
        let mKey = keys[0];
        if (!this.isValidMKey(mKey)) {
            throw new IInsightFacade_1.InsightError("Invalid key in " + filter);
        }
        if (typeof value !== "number") {
            throw new IInsightFacade_1.InsightError("Expect value in " + filter + " to be a number");
        }
        switch (filter) {
            case "LT":
                result = previousResult.filter((element) => {
                    return element[mKey] < value;
                });
                break;
            case "GT":
                previousResult.forEach((element) => {
                    if (element[mKey] > value) {
                        result.push(element);
                    }
                });
                break;
            case "EQ":
                previousResult.forEach((element) => {
                    if (element[mKey] === value) {
                        result.push(element);
                    }
                });
                break;
        }
        return result;
    }
    sComparator(object, filter, previousResult) {
        let keys = Object.keys(object);
        let value = Object.values(object)[0];
        let result = [];
        if (keys.length !== 1) {
            throw new IInsightFacade_1.InsightError("Excess keys in FILTER");
        }
        let sKey = keys[0];
        if (!this.isValidSKey(sKey)) {
            throw new IInsightFacade_1.InsightError("Invalid key in " + filter);
        }
        if (typeof value !== "string") {
            throw new IInsightFacade_1.InsightError("Expect value in " + filter + " to be a string");
        }
        let s = value.split("*");
        switch (s.length) {
            case 1:
                result = previousResult.filter((element) => {
                    return element[sKey] === s[0];
                });
                break;
            case 2:
                if (s[0] === "") {
                    result = previousResult.filter((element) => {
                        return element[sKey].endsWith(s[1]);
                    });
                }
                else if (s[1] === "") {
                    result = previousResult.filter((element) => {
                        return element[sKey].startsWith(s[0]);
                    });
                }
                else {
                    throw new IInsightFacade_1.InsightError("Invalid Input String");
                }
                break;
            case 3:
                if (s[0] === "" && s[2] === "") {
                    result = previousResult.filter((element) => {
                        return element[sKey].includes(s[1]);
                    });
                }
                else {
                    throw new IInsightFacade_1.InsightError("Invalid Input String");
                }
                break;
            default:
                throw new IInsightFacade_1.InsightError("Invalid Input String");
        }
        return result;
    }
    lComparator(object, filter, previousResult) {
        let l = object.length;
        for (let i = 0; i < l; i++) {
            if (!this.queryValidator.validJson(object[i])) {
                throw new IInsightFacade_1.InsightError("Invalid filters in " + filter);
            }
            if (Object.keys(object[i]).length > 1) {
                throw new IInsightFacade_1.InsightError("Excess filters in " + filter);
            }
        }
        let filterArray = object;
        if (filterArray === undefined || filterArray === null || typeof (filterArray) !== "object") {
            throw new IInsightFacade_1.InsightError("Expect " + filter + " to be an object");
        }
        if (!Array.isArray(filterArray) || !filterArray.length) {
            throw new IInsightFacade_1.InsightError("Expect " + filter + " to be an array of filters");
        }
        if (filterArray.length < 1) {
            throw new IInsightFacade_1.InsightError("Expect at least one FILTER in " + filter);
        }
        filterArray.forEach((element) => {
            if (!this.queryValidator.validJson(element)) {
                throw new IInsightFacade_1.InsightError("Invalid filters in " + filter);
            }
        });
        let result;
        if (filter === "AND") {
            result = this.land(filterArray, previousResult);
        }
        else {
            result = this.lor(filterArray, previousResult);
        }
        return result;
    }
    land(and, previousResult) {
        let result = this.filterSolution(and[0][Object.keys(and[0])[0]], Object.keys(and[0])[0], previousResult);
        let l = and.length;
        for (let i = 1; i < l; i++) {
            let f = Object.keys(and[i])[0];
            result = this.filterSolution(and[i][f], f, result);
        }
        return result;
    }
    lor(or, previousResult) {
        let result = this.filterSolution(or[0][Object.keys(or[0])[0]], Object.keys(or[0])[0], previousResult);
        let l = or.length;
        for (let i = 1; i < l; i++) {
            let newSolution = this.filterSolution(or[i][Object.keys(or[i])[0]], Object.keys(or[i])[0], previousResult);
            newSolution.forEach((element) => {
                if (result.indexOf(element) === -1) {
                    result.push(element);
                }
            });
        }
        return result;
    }
    neg(not, filter, previousResult) {
        if (Object.keys(not).length !== 1) {
            throw new IInsightFacade_1.InsightError("Excess filters in NOT");
        }
        let f = Object.keys(not)[0];
        let newSolution = this.filterSolution(not[f], f, previousResult);
        return previousResult.filter((element) => {
            return !newSolution.includes(element);
        });
    }
    isValidMKey(mKey) {
        let dividedMKey = mKey.toString().split("_");
        if (dividedMKey.length !== 2) {
            return false;
        }
        if (this.datasetId === dividedMKey[0]) {
            if (this.queryValidator.isOneOfTheMFields(dividedMKey[1], this.queryValidator.getDatasetKind())) {
                return true;
            }
        }
        return false;
    }
    isValidSKey(sKey) {
        let dividedSKey = sKey.split("_");
        if (dividedSKey.length !== 2) {
            return false;
        }
        if (this.datasetId === dividedSKey[0]) {
            if (this.queryValidator.isOneOfTheSFields(dividedSKey[1], this.queryValidator.getDatasetKind())) {
                return true;
            }
        }
        return false;
    }
}
exports.Filter = Filter;
//# sourceMappingURL=Filter.js.map