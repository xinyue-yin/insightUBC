"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IInsightFacade_1 = require("./IInsightFacade");
const fs = require("fs");
const Filter_1 = require("./Filter");
const QueryValidator_1 = require("./QueryValidator");
const QueryTransformer_1 = require("./QueryTransformer");
const Sorter_1 = require("./Sorter");
exports.Validator = (function () {
    let instance;
    function createInstance() {
        return new QueryValidator_1.QueryValidator();
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
class QueryEngine {
    constructor() {
        this.solution = [];
        this.datasetId = null;
        this.columns = [];
        this.order = null;
        this.group = [];
        this.apply = [];
        this.queryValidator = exports.Validator.getInstance();
    }
    query(query) {
        return new Promise((resolve, reject) => {
            this.validateQuery(query).then(() => {
                let filter = Object.keys(query.WHERE)[0];
                let fil = new Filter_1.Filter(this.datasetId);
                if (Object.keys(query.WHERE).length !== 0) {
                    this.solution = fil.filterSolution(query.WHERE[filter], filter, this.solution);
                }
                if (query.hasOwnProperty("TRANSFORMATIONS")) {
                    let queryTransformer = new QueryTransformer_1.QueryTransformer();
                    this.solution = queryTransformer.transform(this.group, this.apply, this.solution);
                }
                if (this.solution.length > 5000) {
                    throw new IInsightFacade_1.ResultTooLargeError("The Result is too big");
                }
                this.filterColumns();
                let sorter = new Sorter_1.Sorter(this.solution);
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
    reset() {
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
    validateQuery(query) {
        return new Promise((resolve, reject) => {
            if (!this.queryValidator.validJson(query)) {
                reject(new IInsightFacade_1.InsightError("Query must be object"));
            }
            let hasTrans = query.hasOwnProperty("TRANSFORMATIONS");
            if (QueryEngine.checkExcessiveKey(query, hasTrans)) {
                reject(new IInsightFacade_1.InsightError("Excess keys in query"));
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
            }
            catch (insightError) {
                reject(insightError);
            }
            resolve();
        });
    }
    parseGroup(input) {
        if (!this.queryValidator.validJson(input)) {
            throw new IInsightFacade_1.InsightError("GROUP must be object");
        }
        else if (!Array.isArray(input) || !input.length) {
            throw new IInsightFacade_1.InsightError("GROUP must be a non empty array");
        }
        let group = [];
        for (let str of input) {
            if (typeof (str) !== "string") {
                throw new IInsightFacade_1.InsightError("GROUP must be an array of strings");
            }
            if (this.queryValidator.isValidIdFieldOfKind(str)) {
                group.push(str);
            }
            else {
                throw new IInsightFacade_1.InsightError("Invalid key in GROUP");
            }
        }
        for (let column of this.columns) {
            if (!this.queryValidator.isValidIdFieldOfKind(column) && !this.queryValidator.isValidApplyKey(column)) {
                throw new IInsightFacade_1.InsightError("Invalid key in COLUMNS");
            }
            else if (!this.queryValidator.isValidApplyKey(column) && !group.includes(column)) {
                throw new IInsightFacade_1.InsightError("Keys in COLUMNS must be in GROUP or APPLY when TRANSFORMATIONS is present");
            }
        }
        return group;
    }
    parseApply(input) {
        if (!Array.isArray(input)) {
            throw new IInsightFacade_1.InsightError("APPLY must be an array");
        }
        else if (!this.queryValidator.validJson(input)) {
            throw new IInsightFacade_1.InsightError("APPLY must be object");
        }
        else if (input.length === 0) {
            for (let keys of this.columns) {
                if (this.queryValidator.isValidApplyKey(keys)) {
                    throw new IInsightFacade_1.InsightError("Invalid key: " + keys + " in COLUMNS");
                }
            }
            return [];
        }
        else {
            let apply = [];
            let applyRuleKeys = [];
            let applyRuleKey;
            for (let applyRule of input) {
                applyRuleKey = this.queryValidator.validateApplyRule(applyRule);
                if (!applyRuleKeys.includes(applyRuleKey)) {
                    applyRuleKeys.push(applyRuleKey);
                    apply.push(applyRule);
                }
                else {
                    throw new IInsightFacade_1.InsightError("Duplicated APPLY key " + applyRuleKey);
                }
            }
            for (let keys of this.columns) {
                if (this.queryValidator.isValidApplyKey(keys) && !applyRuleKeys.includes(keys)) {
                    throw new IInsightFacade_1.InsightError("Invalid key: " + keys + " in COLUMNS");
                }
            }
            return apply;
        }
    }
    static checkExcessiveKey(query, hasTrans) {
        return Object.keys(query).length !== 2 && !hasTrans ||
            hasTrans && Object.keys(query).length !== 3;
    }
    parseColumns(input, hasTrans) {
        if (!this.queryValidator.validJson(input)) {
            throw new IInsightFacade_1.InsightError("COLUMN must be object");
        }
        else if (!Array.isArray(input) || !input.length) {
            throw new IInsightFacade_1.InsightError("COLUMN must be a non empty array");
        }
        let columns = [];
        for (let str of input) {
            if (typeof (str) !== "string") {
                throw new IInsightFacade_1.InsightError("COLUMN must be an array of strings");
            }
            if (this.queryValidator.isValidIdField(str)) {
                columns.push(str);
            }
            else if (hasTrans && this.queryValidator.isValidApplyKey(str)) {
                columns.push(str);
            }
            else {
                throw new IInsightFacade_1.InsightError("Invalid id_field in COLUMNS");
            }
        }
        return columns;
    }
    parseOrder(options) {
        if (Object.keys(options).length === 1) {
            return null;
        }
        if (!options.hasOwnProperty("ORDER")) {
            throw new IInsightFacade_1.InsightError("Excessive key in OPTIONS");
        }
        if (this.queryValidator.validateOrder(options.ORDER)) {
            return options.ORDER;
        }
        else {
            throw new IInsightFacade_1.InsightError("Invalid ORDER");
        }
    }
    tryReadDataset() {
        try {
            const path = __dirname + "/../../data/" + this.datasetId + ".json";
            let f = fs.readFileSync(path, { encoding: "utf8" });
            let file = JSON.parse(f);
            this.determineKind(file.Dataset.kind);
            this.solution = file.Data;
        }
        catch (_a) {
            throw new IInsightFacade_1.InsightError("Dataset not Found");
        }
    }
    determineKind(kindStr) {
        if (kindStr === "courses") {
            this.datasetKind = IInsightFacade_1.InsightDatasetKind.Courses;
        }
        else if (kindStr === "rooms") {
            this.datasetKind = IInsightFacade_1.InsightDatasetKind.Rooms;
        }
    }
    filterColumns() {
        this.solution.forEach((element) => {
            Object.keys(element).forEach((key) => {
                if (!this.columns.includes(key)) {
                    delete element[key];
                }
            });
        });
    }
}
exports.QueryEngine = QueryEngine;
//# sourceMappingURL=QueryEngine.js.map