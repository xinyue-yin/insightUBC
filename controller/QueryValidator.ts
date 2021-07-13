import {InsightDatasetKind, InsightError} from "./IInsightFacade";

export const mFields: any = {
    courses: ["avg", "pass", "fail", "audit", "year"],
    rooms: ["lat", "lon", "seats"]
};

export const sFields: any = {
    courses: ["dept", "id", "instructor", "title", "uuid"],
    rooms: ["fullname", "shortname", "number", "name", "address", "type", "furniture", "href"]
};

export const applyToken: string[] = ["MAX", "MIN", "AVG", "COUNT", "SUM"];

export class QueryValidator {
    private datasetId: string = null;
    private datasetKind: InsightDatasetKind;
    private columns: string[] = [];

    public validateWhere(query: any): void {
        if (!query.hasOwnProperty("WHERE")) {
            throw new InsightError("Missing WHERE");
        } else if (!this.validJson(query.WHERE)) {
            throw new InsightError("WHERE must be object");
        } else if (Object.keys(query.WHERE).length > 1) {
            throw new InsightError("Excess keys in WHERE");
        } else if (Object.keys(query.WHERE).length > 1) {
            throw new InsightError("Multiple filters in WHERE");
        } else {
            return;
        }
    }


    public validateOptions(query: any): void {
        if (!query.hasOwnProperty("OPTIONS")) {
            throw new InsightError("Missing OPTIONS");
        } else if (!this.validJson(query.OPTIONS)) {
            throw new InsightError("OPTIONS must be object");
        } else if (Object.keys(query.OPTIONS).length > 2) {
            throw new InsightError("Excess keys in OPTIONS");
        } else if (!query.OPTIONS.hasOwnProperty("COLUMNS")) {
            throw new InsightError("Missing COLUMNS in OPTIONS");
        } else if (Object.keys(query.OPTIONS).length === 2 && !query.OPTIONS.hasOwnProperty("ORDER")) {
            throw new InsightError("Invalid keys in OPTIONS");
        } else {
            return;
        }
    }

    // Group and apply is basically like order where I modify the solution based on the apply rule
    public validateTransformations(trans: any): void {
        if (!this.validJson(trans)) {
            throw new InsightError("TRANSFORMATION must be object");
        } else if (!trans.hasOwnProperty("GROUP")) {
            throw new InsightError("TRANSFORMATION missing GROUP");
        } else if (!trans.hasOwnProperty("APPLY")) {
            throw new InsightError("TRANSFORMATION missing APPLY");
        } else if (Object.keys(trans).length > 2) {
            throw new InsightError("Excess keys in TRANSFORMATION");
        }
    }

    public validateColumns(columns: string[]): void {
        for (let column of columns) {
            if (!this.isValidIdFieldOfKind(column) && !this.isValidApplyKey(column)) {
                throw new InsightError("Invalid key " + column + " in COLUMNS");
            }
        }
    }


    // check if is valid id field
    // check if id_field contains only one _
    // check if id matches dataset
    public isValidIdField(str: any): boolean {
        if (typeof (str) !== "string") {
            return false;
        }
        let divided: string[] = str.toString().split("_");
        if (divided.length !== 2) {
            return false;
        }
        if (this.datasetId === null) {
            if (this.isOneOfTheFields(divided[1])) {
                this.datasetId = divided[0];
                return true;
            }
        } else if (this.datasetId === divided[0]) {
            if (this.isOneOfTheFields(divided[1])) {
                return true;
            }
        } else {
            throw new InsightError("Cannot query more than one dataset");
        }
        return false;
    }


    // returns false if the query has no order
    // stores the order id_field in this.order
    // return true if the order is valid, false otherwise
    public validateOrder(order: any): boolean {
        if (order === null || order === undefined) {
            throw new InsightError("ORDER cannot be null or undefined");
        }
        if (this.validateOrderString(order)) {
            return true;
        } else {
            return this.validateOrderObject(order);
        }
    }

    private validateOrderString(input: any): boolean {
        return this.isValidIdFieldOfKind(input) && this.columns.includes(input) ||
            this.isValidApplyKey(input) && this.columns.includes(input);
    }

    public isValidIdFieldOfKind(input: any): boolean {
        if (this.datasetKind === undefined || this.datasetKind === null) {
            throw new Error("Dataset kind has not yet been determined");
        }
        if (typeof(input) !== "string") {
            return false;
        }
        let divided: string[] = input.toString().split("_");
        if (divided.length !== 2) {
            return false;
        }
        if (this.datasetId === divided[0]) {
            if (this.datasetKind === InsightDatasetKind.Courses) {
                return this.isOneOfTheCoursesFields(divided[1]);
            } else {
                return this.isOneOfTheRoomsFields(divided[1]);
            }
        } else {
            throw new InsightError("Cannot query more than one dataset");
        }
    }

    private validateOrderObject(input: any): boolean {
        if (!this.validJson(input)) {
            throw new InsightError("invalid ORDER type");
        } else if (!input.hasOwnProperty("dir")) {
            throw new InsightError("ORDER missing 'dir' key");
        } else if (!input.hasOwnProperty("keys")) {
            throw new InsightError("ORDER missing 'keys' key");
        } else if (Object.keys(input).length > 2) {
            throw new InsightError("Extra keys in ORDER");
        } else if (!Array.isArray(input.keys) || !input.keys.length) {
            throw new InsightError("ORDER keys must be a non-empty array");
        } else if (input.dir !== "UP" && input.dir !== "DOWN") {
            throw new InsightError("Invalid ORDER direction");
        }
        let isValid: boolean = false;
        for (let str of input.keys) {
            isValid = this.validateOrderString(str);
        }
        return isValid;
    }

    public validateApplyRule(applyRule: any): string {
        if (!this.validJson(applyRule)) {
            throw new InsightError("Apply rule must be an object");
        }
        let applyKeys: any[] = Object.keys(applyRule);
        if (applyKeys.length !== 1) {
            throw new InsightError("Apply rule should only have 1 key, has " + applyKeys.length);
        } else if (typeof(applyKeys[0]) !== "string") {
            throw new InsightError("Invalid JSON format");
        } else if (!this.isValidApplyKey(applyKeys[0])) {
            throw new InsightError("Cannot have underscore in applyKey");
        } else {
            this.validateApplyBody(applyRule[applyKeys[0]]);
            return applyKeys[0];
        }
    }


    public validateApplyBody(applyBody: any): void {
        if (!this.validJson(applyBody)) {
            throw new InsightError("Apply body must be an object");
        }
        let applyBodyKeys: any[] = Object.keys(applyBody);
        if (applyBodyKeys.length !== 1) {
            throw new InsightError("Apply body should only have 1 key, has " + applyBodyKeys.length);
        } else if (typeof(applyBodyKeys[0]) !== "string") {
            throw new InsightError("Invalid JSON format");
        }
        let token: string = applyBodyKeys[0];
        if (!applyToken.includes(token)) {
            throw new InsightError("Invalid transformation operator");
        }
        let key: any = applyBody[token];
        if (!this.isValidIdFieldOfKind(key)) {
            throw new InsightError("Invalid apply rule target key");
        }
        if (token !== "COUNT") {
            let divided: string[] = key.toString().split("_");
            if (!this.isOneOfTheMFields(divided[1])) {
                throw new InsightError("Invalid key type in " + token);
            }
        }
    }

    // check to see if str is a valid object
    public validJson(str: any): boolean {
        return str !== undefined && str !== null && typeof (str) === "object";
    }

    public isOneOfTheFields(str: string): boolean {
        return this.isOneOfTheMFields(str) || this.isOneOfTheSFields(str);
    }

    public isOneOfTheMFields(str: string, kind: InsightDatasetKind = null): boolean {
        if (kind === InsightDatasetKind.Courses) {
            return mFields.courses.includes(str);
        } else if (kind === InsightDatasetKind.Rooms) {
            return mFields.rooms.includes(str);
        } else {
            return mFields.courses.includes(str) || mFields.rooms.includes(str);
        }
    }

    public isOneOfTheSFields(str: string, kind: InsightDatasetKind = null): boolean {
        if (kind === InsightDatasetKind.Courses) {
            return sFields.courses.includes(str);
        } else if (kind === InsightDatasetKind.Rooms) {
            return sFields.rooms.includes(str);
        } else {
            return sFields.courses.includes(str) || sFields.rooms.includes(str);
        }
    }

    public isOneOfTheCoursesFields(str: string): boolean {
        return sFields.courses.includes(str) || mFields.courses.includes(str);
    }

    public isOneOfTheRoomsFields(str: string): boolean {
        return sFields.rooms.includes(str) || mFields.rooms.includes(str);
    }

    public isValidApplyKey(input: any): boolean {
        return !(input === undefined || input === null || typeof(input) !== "string" || input.includes("_"));
    }

    public getDatasetId(): string {
        return this.datasetId;
    }

    public setDatasetId(id: string): void {
        this.datasetId = id;
    }

    public setDatasetKind(kind: InsightDatasetKind): void {
        this.datasetKind = kind;
    }

    public getDatasetKind(): InsightDatasetKind {
        return this.datasetKind;
    }

    public setColumns(columns: string[]) {
        this.columns = columns;
    }
}
