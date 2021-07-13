import {InsightDatasetKind, InsightError, ResultTooLargeError} from "./IInsightFacade";
import * as fs from "fs";
import {Filter} from "./Filter";
import {QueryValidator} from "./QueryValidator";
import {QueryTransformer} from "./QueryTransformer";
import {Sorter} from "./Sorter";

// I got singleton pattern for javascript from here: https://www.dofactory.com/javascript/design-patterns/singleton
export const Validator = (function () {
    let instance: QueryValidator;

    function createInstance() {
        return new QueryValidator();
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();

export class QueryEngine {

    private solution: any[] = [];
    private datasetId: string = null;
    private datasetKind: InsightDatasetKind;
    private columns: string[] = [];
    private order: any = null;
    private group: string[] = [];
    private apply: any[] = [];
    private queryValidator: QueryValidator = Validator.getInstance();

    // pass the valid query into Filter, returns the query result if is valid, reject if query is invalid
    public query(query: any): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            this.validateQuery(query).then(() => {
                let filter: string = Object.keys(query.WHERE)[0];
                let fil: Filter = new Filter(this.datasetId);
                if (Object.keys(query.WHERE).length !== 0) {
                    this.solution = fil.filterSolution(query.WHERE[filter], filter, this.solution);
                }
                if (query.hasOwnProperty("TRANSFORMATIONS")) {
                    let queryTransformer: QueryTransformer = new QueryTransformer();
                    this.solution = queryTransformer.transform(this.group, this.apply, this.solution);
                }
                if (this.solution.length > 5000) {
                    throw new ResultTooLargeError("The Result is too big");
                }
                this.filterColumns();
                let sorter: Sorter = new Sorter(this.solution);
                sorter.rearrangeOrder(this.order);
                this.reset();
                resolve(this.solution);
            }).catch((err) => {
                this.solution = [];
                this.reset();
                reject(err);
            });
        });
    }

    private reset(): void {
        this.datasetId = null;
        this.datasetKind = undefined;
        this.columns = [];
        this.order = null;
        this.group = [];
        this.apply = [];
        this.queryValidator.setDatasetId(null);
        this.queryValidator.setDatasetKind(undefined);
        this.queryValidator.setColumns([]);
    }

    // checks whether the query is valid
    public validateQuery(query: any): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this.queryValidator.validJson(query)) {
                reject(new InsightError("Query must be object"));
            }
            let hasTrans: boolean = query.hasOwnProperty("TRANSFORMATIONS");
            if (QueryEngine.checkExcessiveKey(query, hasTrans)) {
                reject(new InsightError("Excess keys in query"));
            }
            try {
                this.queryValidator.validateWhere(query);
                this.queryValidator.validateOptions(query);
                this.columns = this.parseColumns(query.OPTIONS.COLUMNS, hasTrans);
                this.queryValidator.setColumns(this.columns);
                this.datasetId = this.queryValidator.getDatasetId();
                this.tryReadDataset();
                this.queryValidator.setDatasetKind(this.datasetKind);
                this.queryValidator.validateColumns(this.columns);
                this.order = this.parseOrder(query.OPTIONS);
                if (hasTrans) {
                    this.queryValidator.validateTransformations(query.TRANSFORMATIONS);
                    this.group = this.parseGroup(query.TRANSFORMATIONS.GROUP);
                    this.apply = this.parseApply(query.TRANSFORMATIONS.APPLY);
                }
            } catch (insightError) {
                reject(insightError);
            }
            resolve();
        });
    }

    private parseGroup(input: any): string[] {
        if (!this.queryValidator.validJson(input)) {
            throw new InsightError("GROUP must be object");
        } else if (!Array.isArray(input) || !input.length) {
            throw new InsightError("GROUP must be a non empty array");
        }
        let group: string[] = [];
        for (let str of input) {
            if (typeof(str) !== "string") {
                throw new InsightError("GROUP must be an array of strings");
            }
            if (this.queryValidator.isValidIdFieldOfKind(str)) {
                group.push(str);
            } else {
                throw new InsightError("Invalid key in GROUP");
            }
        }
        for (let column of this.columns) {
            if (!this.queryValidator.isValidIdFieldOfKind(column) && !this.queryValidator.isValidApplyKey(column)) {
                throw new InsightError("Invalid key in COLUMNS");
            } else if (!this.queryValidator.isValidApplyKey(column) && !group.includes(column)) {
                throw new InsightError(
                    "Keys in COLUMNS must be in GROUP or APPLY when TRANSFORMATIONS is present"
                );
            }
        }
        return group;
    }

    public parseApply(input: any): any[] {
        if (!Array.isArray(input)) {
            throw new InsightError("APPLY must be an array");
        } else if (!this.queryValidator.validJson(input)) {
            throw new InsightError("APPLY must be object");
        } else if (input.length === 0) {
            for (let keys of this.columns) {
                if (this.queryValidator.isValidApplyKey(keys)) {
                    throw new InsightError("Invalid key: " + keys + " in COLUMNS");
                }
            }
            return [];
        } else {  // input.length !== 0
            let apply: any[] = [];
            let applyRuleKeys: string[] = [];
            let applyRuleKey: string;
            for (let applyRule of input) {
                applyRuleKey = this.queryValidator.validateApplyRule(applyRule);
                if (!applyRuleKeys.includes(applyRuleKey)) {
                    applyRuleKeys.push(applyRuleKey);
                    apply.push(applyRule);
                } else {
                    throw new InsightError("Duplicated APPLY key " + applyRuleKey);
                }
            }
            for (let keys of this.columns) {
                if (this.queryValidator.isValidApplyKey(keys) && !applyRuleKeys.includes(keys)) {
                    throw new InsightError("Invalid key: " + keys + " in COLUMNS");
                }
            }
            return apply;
        }
    }

    private static checkExcessiveKey(query: any, hasTrans: boolean): boolean {
        return Object.keys(query).length !== 2 && !hasTrans ||
            hasTrans && Object.keys(query).length !== 3;
    }


    // check if field is included in mFields or sFields if no Trans
    // allows for custom key (anyKey) if Trans exists
    // store the parsed columns in the private variable this.columns as an array of id_field
    public parseColumns(input: any[], hasTrans: boolean): string[] {
        if (!this.queryValidator.validJson(input)) {
            throw new InsightError("COLUMN must be object");
        } else if (!Array.isArray(input) || !input.length) {
            throw new InsightError("COLUMN must be a non empty array");
        }
        let columns: string[] = [];
        for (let str of input) {
            if (typeof(str) !== "string") {
                throw new InsightError("COLUMN must be an array of strings");
            }
            if (this.queryValidator.isValidIdField(str)) {
                columns.push(str);
            } else if (hasTrans && this.queryValidator.isValidApplyKey(str)) {
                columns.push(str);
            } else {
                throw new InsightError("Invalid id_field in COLUMNS");
            }
        }
        return columns;
    }


    private parseOrder(options: any): any {
        if (Object.keys(options).length === 1) { // There's no oder key present
            return null;
        }
        if (!options.hasOwnProperty("ORDER")) {
            throw new InsightError("Excessive key in OPTIONS");
        }
        if (this.queryValidator.validateOrder(options.ORDER)) {
            return options.ORDER;
        } else {
            throw new InsightError("Invalid ORDER");
        }
    }


    // assume WHERE and OPTIONS are correctly formatted
    // check if the dataset exist, load datasets to this.solution
    // return true if correctly load, false otherwise
    public tryReadDataset(): void {
        try {
            const path = __dirname + "/../../data/" + this.datasetId + ".json";
            let f = fs.readFileSync(path, { encoding: "utf8" });
            let file = JSON.parse(f);
            this.determineKind(file.Dataset.kind);
            this.solution = file.Data;
        } catch {
            throw new InsightError("Dataset not Found");
        }
    }

    private determineKind(kindStr: string): void {
        if (kindStr === "courses") {
            this.datasetKind = InsightDatasetKind.Courses;
        } else if (kindStr === "rooms") {
            this.datasetKind = InsightDatasetKind.Rooms;
        }
    }

    // filter the columns in this.solution using values in this.columns
    public filterColumns(): void {
        this.solution.forEach((element) => {
            Object.keys(element).forEach((key) => {
                if (!this.columns.includes(key)) {
                    delete element[key];
                }
            });
        });
    }
}
