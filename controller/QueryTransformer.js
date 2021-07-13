"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IInsightFacade_1 = require("./IInsightFacade");
const decimal_js_1 = require("decimal.js");
class QueryTransformer {
    transform(group, apply, solution) {
        this.group = group;
        this.apply = apply;
        this.previousSolution = solution;
        let result;
        let groupedResult;
        groupedResult = this.groupTransform();
        result = this.applyTransform(groupedResult);
        return result;
    }
    groupTransform() {
        let result = {};
        for (let dataElement of this.previousSolution) {
            let groupName = this.createGroupName(dataElement);
            if (!Object.keys(result).length) {
                Object.defineProperty(result, groupName, {
                    value: [dataElement],
                    writable: true,
                    enumerable: true
                });
            }
            else if (!result.hasOwnProperty(groupName)) {
                Object.defineProperty(result, groupName, {
                    value: [dataElement],
                    writable: true,
                    enumerable: true
                });
            }
            else {
                result[groupName].push(dataElement);
            }
        }
        return result;
    }
    createGroupName(dataElement) {
        let groupName = "";
        for (let index = 0; index < this.group.length; index++) {
            if (index < this.group.length - 1) {
                groupName = groupName + dataElement[this.group[index]] + "_";
            }
            else {
                groupName = groupName + dataElement[this.group[index]];
            }
        }
        return groupName;
    }
    applyTransform(groupedResult) {
        let result = [];
        let keys = Object.keys(groupedResult);
        if (keys.length > 0) {
            for (let key of keys) {
                let elementArray = groupedResult[key];
                result.push(this.applyToEachGroup(elementArray));
            }
        }
        return result;
    }
    applyToEachGroup(elementArray) {
        let result = {};
        for (let groupKey of this.group) {
            result[groupKey] = elementArray[0][groupKey];
        }
        if (this.apply.length !== 0) {
            for (let applyBody of this.apply) {
                let name = Object.keys(applyBody)[0];
                let applyToken = Object.keys(applyBody[name])[0];
                let key = applyBody[name][applyToken];
                let keyValueArray = [];
                for (let element of elementArray) {
                    keyValueArray.push(element[key]);
                }
                result[name] = this.applyApplyToken(applyToken, keyValueArray);
            }
        }
        return result;
    }
    applyApplyToken(applyToken, keyValueArray) {
        let result;
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
                throw new IInsightFacade_1.InsightError("Invalid ApplyToken that had not been caught in validator");
        }
        return result;
    }
    max(keyValueArray) {
        return keyValueArray.reduce((a, b) => Math.max(a, b));
    }
    min(keyValueArray) {
        return keyValueArray.reduce((a, b) => Math.min(a, b));
    }
    avg(keyValueArray) {
        let decimalArray = [];
        for (let num of keyValueArray) {
            decimalArray.push(new decimal_js_1.Decimal(num));
        }
        let sum = decimalArray.reduce((a, b) => decimal_js_1.Decimal.add(a, b), new decimal_js_1.Decimal(0)).toNumber();
        return Number((sum / keyValueArray.length).toFixed(2));
    }
    sum(keyValueArray) {
        let decimalArray = [];
        for (let num of keyValueArray) {
            decimalArray.push(new decimal_js_1.Decimal(num));
        }
        let sum = decimalArray.reduce((a, b) => decimal_js_1.Decimal.add(a, b), new decimal_js_1.Decimal(0)).toNumber();
        return Number(sum.toFixed(2));
    }
    count(keyValueArray) {
        let uniqueValues = {};
        return keyValueArray.reduce(function (acc, currentValue) {
            if (uniqueValues.hasOwnProperty(currentValue)) {
                return acc;
            }
            else {
                uniqueValues[currentValue] = currentValue;
                return acc + 1;
            }
        }, 0);
    }
}
exports.QueryTransformer = QueryTransformer;
//# sourceMappingURL=QueryTransformer.js.map