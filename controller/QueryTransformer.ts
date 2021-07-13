import {InsightError} from "./IInsightFacade";
import {Decimal} from "decimal.js";

export class QueryTransformer {
    private group: string[];
    private apply: any[];
    private previousSolution: any[];

    public transform(group: string[], apply: any[], solution: any[]): any[] {
        this.group = group;
        this.apply = apply;
        this.previousSolution = solution;
        let result: any;
        let groupedResult: any;
        groupedResult = this.groupTransform();
        result = this.applyTransform(groupedResult);
        return result;
    }


    public groupTransform(): any {
        let result: any = {};
        for (let dataElement of this.previousSolution) {
            let groupName: string = this.createGroupName(dataElement);
            if (!Object.keys(result).length) {
                Object.defineProperty(result, groupName, {
                    value: [dataElement],
                    writable: true,
                    enumerable: true
                });
            } else if (!result.hasOwnProperty(groupName)) {
                Object.defineProperty(result, groupName, {
                    value: [dataElement],
                    writable: true,
                    enumerable: true
                });
            } else {
                result[groupName].push(dataElement);
            }
        }
        return result;
    }

    public createGroupName(dataElement: any): string {
        let groupName: string = "";
        for (let index = 0; index < this.group.length; index++) {
            if (index < this.group.length - 1) {
                groupName = groupName + dataElement[this.group[index]] + "_";
            } else {
                groupName = groupName + dataElement[this.group[index]];
            }
        }
        return groupName;
    }

    public applyTransform(groupedResult: any): any[] {
        let result: any[] = []; // This should be an array of sections/elements
        let keys: string[] = Object.keys(groupedResult);
        if (keys.length > 0) {
            for (let key of keys) {
                let elementArray: any[] = groupedResult[key];
                result.push(this.applyToEachGroup(elementArray));
            }
        }
        return result;
    }


    public applyToEachGroup(elementArray: any[]): any {
        let result: any = {};
        for (let groupKey of this.group) {
            result[groupKey] = elementArray[0][groupKey];
        }
        if (this.apply.length !== 0) {
            for (let applyBody of this.apply) {
                let name: string = Object.keys(applyBody)[0];
                let applyToken: string = Object.keys(applyBody[name])[0];
                let key: string = applyBody[name][applyToken];
                let keyValueArray: any[] = [];   // Need to take out every value for the given key
                for (let element of elementArray) {
                    keyValueArray.push(element[key]);
                }
                result[name] = this.applyApplyToken(applyToken, keyValueArray);
            }
        }
        return result;
    }

    public applyApplyToken(applyToken: string, keyValueArray: any[]): number {
        let result: number;
        switch (applyToken) {
            case "MAX":
                result = this.max(keyValueArray);
                break;
            case "MIN":
                result = this.min(keyValueArray);
                break;
            case "AVG":
                result = this.avg(keyValueArray);
                break;
            case "COUNT":
                result = this.count(keyValueArray);
                break;
            case "SUM":
                result = this.sum(keyValueArray);
                break;
            default:
                throw new InsightError("Invalid ApplyToken that had not been caught in validator");
        }
        return result;
    }

    private max(keyValueArray: number[]): number {
        return keyValueArray.reduce((a, b) => Math.max(a, b));
    }

    private min(keyValueArray: number[]): number {
        return keyValueArray.reduce((a, b) => Math.min(a, b));
    }

    private avg(keyValueArray: number[]): number {
        let decimalArray: Decimal[] = [];
        for (let num of keyValueArray) {
            decimalArray.push(new Decimal(num));
        }
        let sum: number = decimalArray.reduce((a, b) =>
            Decimal.add(a, b), new Decimal(0)).toNumber();
        return Number((sum / keyValueArray.length).toFixed(2));
    }

    private sum(keyValueArray: number[]): number {
        let decimalArray: Decimal[] = [];
        for (let num of keyValueArray) {
            decimalArray.push(new Decimal(num));
        }
        let sum: number = decimalArray.reduce((a, b) =>
            Decimal.add(a, b), new Decimal(0)).toNumber();
        return Number(sum.toFixed(2));
    }

    private count(keyValueArray: any[]): number {
        let uniqueValues: any = {};
        return keyValueArray.reduce(function (acc: number, currentValue) {
            if (uniqueValues.hasOwnProperty(currentValue)) {
                return acc;
            } else {
                uniqueValues[currentValue] = currentValue;
                return acc + 1;
            }
        }, 0);
    }
}
