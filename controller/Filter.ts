import {InsightDatasetKind, InsightError} from "./IInsightFacade";
import {QueryValidator} from "./QueryValidator";
import {Validator} from "./QueryEngine";

export class Filter {
    private readonly datasetId: string;
    private queryValidator: QueryValidator;
    private datasetKind: InsightDatasetKind;

    // set this.datasedId to the input id
    constructor(id: string) {
        this.datasetId = id;
        this.queryValidator = Validator.getInstance();
        this.datasetKind = this.queryValidator.getDatasetKind();
    }

    // pass the solution array to the corresponding operators based on filter
    public filterSolution(object: any, filter: string, solution: any[]): any[] {
        let result: any[] = [];
        if (!this.queryValidator.validJson(object)) {
            throw new InsightError("Invalid object in " + filter);
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
                throw new InsightError("Invalid Filter");
        }
        return result;
    }

    // mComparator ::= 'LT' | 'GT' | 'EQ'
    // mComparator, return the filtered solution, throw an error if the query is invalid
    public mComparator(object: any, filter: string, previousResult: any[]): any[] {
        let keys = Object.keys(object);
        let value = Object.values(object)[0];
        let result: any[] = [];
        if (keys.length !== 1) {
            throw new InsightError("Excess keys in FILTER");
        }
        let mKey = keys[0];
        if (!this.isValidMKey(mKey)) {
            throw new InsightError("Invalid key in " + filter);
        }
        if (typeof value !== "number") {
            throw new InsightError(
                "Expect value in " + filter + " to be a number",
            );
        }
        switch (filter) {
            case "LT" :
                result = previousResult.filter((element) => {
                    return element[mKey] < value;
                });
                break;
            case "GT" :
                previousResult.forEach((element) => {
                    if (element[mKey] > value) {
                        result.push(element);
                    }
                });
                break;
            case "EQ" :
                previousResult.forEach((element) => {
                    if (element[mKey] === value) {
                        result.push(element);
                    }
                });
                break;
        }
        return result;
    }

    // sComparator ::= 'IS:{' sKey ':' [*]? inputString [*]? '}' where Asterisks should act as wildcards.
    // sComparator, return the filtered solution, throw an error if the query is invalid
    public sComparator(object: any, filter: string, previousResult: any[]): any[] {
        let keys = Object.keys(object);
        let value = Object.values(object)[0];
        let result: any[] = [];
        if (keys.length !== 1) {
            throw new InsightError("Excess keys in FILTER");
        }
        let sKey = keys[0];
        if (!this.isValidSKey(sKey)) {
            throw new InsightError("Invalid key in " + filter);
        }
        if (typeof value !== "string") {
            throw new InsightError(
                "Expect value in " + filter + " to be a string",
            );
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
                } else if (s[1] === "") {
                    result = previousResult.filter((element) => {
                        return element[sKey].startsWith(s[0]);
                    });
                } else {
                    throw new InsightError("Invalid Input String");
                }
                break;
            case 3:
                if (s[0] === "" && s[2] === "") {
                    result = previousResult.filter((element) => {
                        return element[sKey].includes(s[1]);
                    });
                } else {
                    throw new InsightError("Invalid Input String");
                }
                break;
            default:
                throw new InsightError("Invalid Input String");
        }
        return result;
    }


    // logicComparator ::= 'AND' | 'OR'
    // lComparator, check if each filter under logicComparator is valid,
    // pass the previousResult to land and lor based on filter
    public lComparator(object: any, filter: string, previousResult: any[]): any[] {
        let l: number = object.length;
        for (let i = 0; i < l; i++) {
            if (!this.queryValidator.validJson(object[i])) {
                throw new InsightError("Invalid filters in " + filter);
            }
            if (Object.keys(object[i]).length > 1) {
                throw new InsightError("Excess filters in " + filter);
            }
        }
        let filterArray: any = object;
        if (filterArray === undefined || filterArray === null || typeof(filterArray) !== "object") {
            throw new InsightError("Expect " + filter + " to be an object");
        }
        if (!Array.isArray(filterArray) || !filterArray.length) {
            throw new InsightError("Expect " + filter + " to be an array of filters");
        }
        if (filterArray.length < 1) {
            throw new InsightError("Expect at least one FILTER in " + filter);
        }
        filterArray.forEach((element) => {
            if (!this.queryValidator.validJson(element)) {
                throw new InsightError("Invalid filters in " + filter);
            }
        });
        let result: any[];
        if (filter === "AND") {
            result = this.land(filterArray, previousResult);
        } else {
            result = this.lor(filterArray, previousResult);
        }
        return result;
    }

    // land operator, pass the previousResult from the previous filter into the next filter,
    // then perform the "and" operation on their results and return it
    public land(and: any, previousResult: any[]) {
        let result = this.filterSolution(and[0][Object.keys(and[0])[0]], Object.keys(and[0])[0], previousResult);
        let l = and.length;
        for (let i = 1; i < l; i++) {
            let f = Object.keys(and[i])[0];
            result = this.filterSolution(and[i][f], f, result);
        }
        return result;
    }

    // lor operator, "or" the results returned from each filter, doesn't include duplicates
    public lor(or: any, previousResult: any[]) {
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

    // negate the result of the filter
    public neg(not: any, filter: string, previousResult: any[]): any[] {
        if (Object.keys(not).length !== 1) {
            throw new InsightError("Excess filters in NOT");
        }
        let f = Object.keys(not)[0];
        let newSolution = this.filterSolution(not[f], f, previousResult);
        return previousResult.filter((element) => {
            return !newSolution.includes(element);
        });
    }

    // check if input is a valid mKey
    public isValidMKey(mKey: string) {
        let dividedMKey: string[] = mKey.toString().split("_");
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

    // check if input is a valid sKey
    public isValidSKey(sKey: string) {
        let dividedSKey: string[] = sKey.split("_");
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
