"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IInsightFacade_1 = require("./IInsightFacade");
exports.mFields = {
    courses: ["avg", "pass", "fail", "audit", "year"],
    rooms: ["lat", "lon", "seats"]
};
exports.sFields = {
    courses: ["dept", "id", "instructor", "title", "uuid"],
    rooms: ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"]
};
exports.applyToken = ["MAX", "MIN", "AVG", "COUNT", "SUM"];
class QueryValidator {
    constructor() {
        this.datasetId = null;
        this.columns = [];
    }
    validateWhere(query) {
        if (!query.hasOwnProperty("WHERE")) {
            throw new IInsightFacade_1.InsightError("Missing WHERE");
        }
        else if (!this.validJson(query.WHERE)) {
            throw new IInsightFacade_1.InsightError("WHERE must be object");
        }
        else if (Object.keys(query.WHERE).length > 1) {
            throw new IInsightFacade_1.InsightError("Excess keys in WHERE");
        }
        else if (Object.keys(query.WHERE).length > 1) {
            throw new IInsightFacade_1.InsightError("Multiple filters in WHERE");
        }
        else {
            return;
        }
    }
    validateOptions(query) {
        if (!query.hasOwnProperty("OPTIONS")) {
            throw new IInsightFacade_1.InsightError("Missing OPTIONS");
        }
        else if (!this.validJson(query.OPTIONS)) {
            throw new IInsightFacade_1.InsightError("OPTIONS must be object");
        }
        else if (Object.keys(query.OPTIONS).length > 2) {
            throw new IInsightFacade_1.InsightError("Excess keys in OPTIONS");
        }
        else if (!query.OPTIONS.hasOwnProperty("COLUMNS")) {
            throw new IInsightFacade_1.InsightError("Missing COLUMNS in OPTIONS");
        }
        else if (Object.keys(query.OPTIONS).length === 2 && !query.OPTIONS.hasOwnProperty("ORDER")) {
            throw new IInsightFacade_1.InsightError("Invalid keys in OPTIONS");
        }
        else {
            return;
        }
    }
    validateTransformations(trans) {
        if (!this.validJson(trans)) {
            throw new IInsightFacade_1.InsightError("TRANSFORMATION must be object");
        }
        else if (!trans.hasOwnProperty("GROUP")) {
            throw new IInsightFacade_1.InsightError("TRANSFORMATION missing GROUP");
        }
        else if (!trans.hasOwnProperty("APPLY")) {
            throw new IInsightFacade_1.InsightError("TRANSFORMATION missing APPLY");
        }
        else if (Object.keys(trans).length > 2) {
            throw new IInsightFacade_1.InsightError("Excess keys in TRANSFORMATION");
        }
    }
    validateColumns(columns) {
        for (let column of columns) {
            if (!this.isValidIdFieldOfKind(column) && !this.isValidApplyKey(column)) {
                throw new IInsightFacade_1.InsightError("Invalid key " + column + " in COLUMNS");
            }
        }
    }
    isValidIdField(str) {
        if (typeof (str) !== "string") {
            return false;
        }
        let divided = str.toString().split("_");
        if (divided.length !== 2) {
            return false;
        }
        if (this.datasetId === null) {
            if (this.isOneOfTheFields(divided[1])) {
                this.datasetId = divided[0];
                return true;
            }
        }
        else if (this.datasetId === divided[0]) {
            if (this.isOneOfTheFields(divided[1])) {
                return true;
            }
        }
        else {
            throw new IInsightFacade_1.InsightError("Cannot query more than one dataset");
        }
        return false;
    }
    validateOrder(order) {
        if (order === null || order === undefined) {
            throw new IInsightFacade_1.InsightError("ORDER cannot be null or undefined");
        }
        if (this.validateOrderString(order)) {
            return true;
        }
        else {
            return this.validateOrderObject(order);
        }
    }
    validateOrderString(input) {
        return this.isValidIdFieldOfKind(input) && this.columns.includes(input) ||
            this.isValidApplyKey(input) && this.columns.includes(input);
    }
    isValidIdFieldOfKind(input) {
        if (this.datasetKind === undefined || this.datasetKind === null) {
            throw new Error("Dataset kind has not yet been determined");
        }
        if (typeof (input) !== "string") {
            return false;
        }
        let divided = input.toString().split("_");
        if (divided.length !== 2) {
            return false;
        }
        if (this.datasetId === divided[0]) {
            if (this.datasetKind === IInsightFacade_1.InsightDatasetKind.Courses) {
                return this.isOneOfTheCoursesFields(divided[1]);
            }
            else {
                return this.isOneOfTheRoomsFields(divided[1]);
            }
        }
        else {
            throw new IInsightFacade_1.InsightError("Cannot query more than one dataset");
        }
    }
    validateOrderObject(input) {
        if (!this.validJson(input)) {
            throw new IInsightFacade_1.InsightError("invalid ORDER type");
        }
        else if (!input.hasOwnProperty("dir")) {
            throw new IInsightFacade_1.InsightError("ORDER missing 'dir' key");
        }
        else if (!input.hasOwnProperty("keys")) {
            throw new IInsightFacade_1.InsightError("ORDER missing 'keys' key");
        }
        else if (Object.keys(input).length > 2) {
            throw new IInsightFacade_1.InsightError("Extra keys in ORDER");
        }
        else if (!Array.isArray(input.keys) || !input.keys.length) {
            throw new IInsightFacade_1.InsightError("ORDER keys must be a non-empty array");
        }
        else if (input.dir !== "UP" && input.dir !== "DOWN") {
            throw new IInsightFacade_1.InsightError("Invalid ORDER direction");
        }
        let isValid = false;
        for (let str of input.keys) {
            isValid = this.validateOrderString(str);
        }
        return isValid;
    }
    validateApplyRule(applyRule) {
        if (!this.validJson(applyRule)) {
            throw new IInsightFacade_1.InsightError("Apply rule must be an object");
        }
        let applyKeys = Object.keys(applyRule);
        if (applyKeys.length !== 1) {
            throw new IInsightFacade_1.InsightError("Apply rule should only have 1 key, has " + applyKeys.length);
        }
        else if (typeof (applyKeys[0]) !== "string") {
            throw new IInsightFacade_1.InsightError("Invalid JSON format");
        }
        else if (!this.isValidApplyKey(applyKeys[0])) {
            throw new IInsightFacade_1.InsightError("Cannot have underscore in applyKey");
        }
        else {
            this.validateApplyBody(applyRule[applyKeys[0]]);
            return applyKeys[0];
        }
    }
    validateApplyBody(applyBody) {
        if (!this.validJson(applyBody)) {
            throw new IInsightFacade_1.InsightError("Apply body must be an object");
        }
        let applyBodyKeys = Object.keys(applyBody);
        if (applyBodyKeys.length !== 1) {
            throw new IInsightFacade_1.InsightError("Apply body should only have 1 key, has " + applyBodyKeys.length);
        }
        else if (typeof (applyBodyKeys[0]) !== "string") {
            throw new IInsightFacade_1.InsightError("Invalid JSON format");
        }
        let token = applyBodyKeys[0];
        if (!exports.applyToken.includes(token)) {
            throw new IInsightFacade_1.InsightError("Invalid transformation operator");
        }
        let key = applyBody[token];
        if (!this.isValidIdFieldOfKind(key)) {
            throw new IInsightFacade_1.InsightError("Invalid apply rule target key");
        }
        if (token !== "COUNT") {
            let divided = key.toString().split("_");
            if (!this.isOneOfTheMFields(divided[1])) {
                throw new IInsightFacade_1.InsightError("Invalid key type in " + token);
            }
        }
    }
    validJson(str) {
        return str !== undefined && str !== null && typeof (str) === "object";
    }
    isOneOfTheFields(str) {
        return this.isOneOfTheMFields(str) || this.isOneOfTheSFields(str);
    }
    isOneOfTheMFields(str, kind = null) {
        if (kind === IInsightFacade_1.InsightDatasetKind.Courses) {
            return exports.mFields.courses.includes(str);
        }
        else if (kind === IInsightFacade_1.InsightDatasetKind.Rooms) {
            return exports.mFields.rooms.includes(str);
        }
        else {
            return exports.mFields.courses.includes(str) || exports.mFields.rooms.includes(str);
        }
    }
    isOneOfTheSFields(str, kind = null) {
        if (kind === IInsightFacade_1.InsightDatasetKind.Courses) {
            return exports.sFields.courses.includes(str);
        }
        else if (kind === IInsightFacade_1.InsightDatasetKind.Rooms) {
            return exports.sFields.rooms.includes(str);
        }
        else {
            return exports.sFields.courses.includes(str) || exports.sFields.rooms.includes(str);
        }
    }
    isOneOfTheCoursesFields(str) {
        return exports.sFields.courses.includes(str) || exports.mFields.courses.includes(str);
    }
    isOneOfTheRoomsFields(str) {
        return exports.sFields.rooms.includes(str) || exports.mFields.rooms.includes(str);
    }
    isValidApplyKey(input) {
        return !(input === undefined || input === null || typeof (input) !== "string" || input.includes("_"));
    }
    getDatasetId() {
        return this.datasetId;
    }
    setDatasetId(id) {
        this.datasetId = id;
    }
    setDatasetKind(kind) {
        this.datasetKind = kind;
    }
    getDatasetKind() {
        return this.datasetKind;
    }
    setColumns(columns) {
        this.columns = columns;
    }
}
exports.QueryValidator = QueryValidator;
//# sourceMappingURL=QueryValidator.js.map