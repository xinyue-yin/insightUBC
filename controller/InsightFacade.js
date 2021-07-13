"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Util_1 = require("../Util");
const IInsightFacade_1 = require("./IInsightFacade");
const jszip = require("jszip");
const fs = require("fs");
const QueryEngine_1 = require("./QueryEngine");
const AddRooms_1 = require("./AddRooms");
class InsightFacade {
    constructor() {
        this.datasetsAdded = [];
        this.dataStructure = {};
        this.datasetsToBeListed = [];
        this.queryEngine = new QueryEngine_1.QueryEngine();
        this.addRooms = new AddRooms_1.AddRooms();
        Util_1.default.trace("InsightFacadeImpl::init()");
    }
    addDataset(id, content, kind) {
        return new Promise((resolve, reject) => {
            let dataset;
            if (!InsightFacade.isIDValid(id)) {
                return reject(new IInsightFacade_1.InsightError("The id is not valid."));
            }
            else if (this.addedBefore(id)) {
                return reject(new IInsightFacade_1.InsightError("This dataset/id have been added before."));
            }
            else if (kind === IInsightFacade_1.InsightDatasetKind.Rooms) {
                dataset = this.addRooms.addDatasetRooms(id, content);
            }
            else if (kind === IInsightFacade_1.InsightDatasetKind.Courses) {
                dataset = this.addDatasetCourses(id, content, kind);
            }
            dataset.then((insightDataset) => {
                this.datasetsAdded.push(id);
                this.datasetsToBeListed.push(insightDataset);
                return resolve(this.datasetsAdded);
            }).catch((err) => {
                return reject(err);
            });
        });
    }
    addDatasetCourses(id, content, kind) {
        return new Promise((resolve, reject) => {
            let folderContents = [];
            let validCourses = [];
            let rowCount = 0;
            jszip.loadAsync(content, { base64: true }).then((result) => {
                result.folder("courses").forEach((relativePath, file) => {
                    folderContents.push(file.async("text"));
                });
                Promise.all(folderContents).then((results) => {
                    let parsedFile;
                    for (let item of results) {
                        parsedFile = InsightFacade.parseJSON(item);
                        if (parsedFile !== null) {
                            validCourses.push(parsedFile);
                        }
                    }
                }).then(() => {
                    let isValidDataset = false;
                    this.initializeCoursesProperties(id);
                    for (let course of validCourses) {
                        let validSections = this.isContainingAtLeastOneSection(course);
                        if (validSections > 0) {
                            isValidDataset = true;
                            rowCount += validSections;
                        }
                    }
                    if (!isValidDataset) {
                        return reject(new IInsightFacade_1.InsightError("Datasets in " + id + " are invalid."));
                    }
                    else {
                        const insightDataset = { id: id, kind: kind, numRows: rowCount };
                        this.dataStructure["Dataset"] = insightDataset;
                        let isWriteSuccessful = this.writeToDisk(id);
                        if (isWriteSuccessful) {
                            return resolve(insightDataset);
                        }
                        else {
                            return reject(new IInsightFacade_1.InsightError("The Write is unsuccessful"));
                        }
                    }
                });
            })
                .catch(() => {
                return reject(new IInsightFacade_1.InsightError("Incorrect file format that caused error in jszip."));
            });
        });
    }
    initializeCoursesProperties(id) {
        this.courseProperties = {
            [id + "_dept"]: "Subject",
            [id + "_id"]: "Course",
            [id + "_avg"]: "Avg",
            [id + "_instructor"]: "Professor",
            [id + "_title"]: "Title",
            [id + "_pass"]: "Pass",
            [id + "_fail"]: "Fail",
            [id + "_audit"]: "Audit",
            [id + "_uuid"]: "id",
            [id + "_year"]: "Year",
        };
    }
    static isIDValid(id) {
        return !(id === undefined ||
            id === null ||
            id.includes("_") ||
            id.trim().length === 0);
    }
    addedBefore(id) {
        const path = __dirname + "/../../data/" + id + ".json";
        if (this.datasetsAdded.some((idString) => idString === id)) {
            try {
                fs.accessSync(path);
                return true;
            }
            catch (error) {
                return false;
            }
        }
    }
    isContainingAtLeastOneSection(json) {
        let result;
        let validSectionCount = 0;
        if (!json.hasOwnProperty("result")) {
            return 0;
        }
        else {
            result = json["result"];
        }
        if (result !== null && Array.isArray(result)) {
            for (let section of result) {
                if (this.isSectionValid(section)) {
                    this.addSectionToDataStructure(section);
                    validSectionCount++;
                }
            }
            return validSectionCount;
        }
        return 0;
    }
    isSectionValid(section) {
        for (let key of Object.keys(this.courseProperties)) {
            if (!section.hasOwnProperty(this.courseProperties[key])) {
                return false;
            }
        }
        return true;
    }
    addSectionToDataStructure(section) {
        const data = "Data";
        let thisSection = {};
        if (section.Section === "overall") {
            section.Year = 1900;
        }
        else {
            section.Year = parseInt(section.Year, 10);
        }
        section.id = section.id.toString();
        if (this.dataStructure.hasOwnProperty(data)) {
            for (let key of Object.keys(this.courseProperties)) {
                thisSection[key] = section[this.courseProperties[key]];
            }
            this.dataStructure[data].push(thisSection);
        }
        else {
            this.dataStructure[data] = [];
            for (let key of Object.keys(this.courseProperties)) {
                thisSection[key] = section[this.courseProperties[key]];
            }
            this.dataStructure[data].push(thisSection);
        }
    }
    static parseJSON(input) {
        let output;
        try {
            output = JSON.parse(input);
        }
        catch (error) {
            return null;
        }
        return output;
    }
    writeToDisk(id) {
        const path = __dirname + "/../../data/" + id + ".json";
        const data = JSON.stringify(this.dataStructure);
        try {
            fs.writeFileSync(path, data);
            this.dataStructure = {};
            return true;
        }
        catch (error) {
            return false;
        }
    }
    removeDataset(id) {
        return new Promise((resolve, reject) => {
            if (!InsightFacade.isIDValid(id)) {
                return reject(new IInsightFacade_1.InsightError("The id is not valid."));
            }
            if (!this.addedBefore(id)) {
                return reject(new IInsightFacade_1.NotFoundError("The dataset haven't been added before"));
            }
            else {
                fs.unlink(__dirname + "/../../data/" + id + ".json", (error) => {
                    if (error !== null) {
                        return reject(new IInsightFacade_1.InsightError("Dataset: " + id + " could not be removed"));
                    }
                    const index = this.datasetsAdded.indexOf(id);
                    if (index === -1) {
                        return reject(new IInsightFacade_1.NotFoundError("Conflict between the results of indexOf and addedBefore"));
                    }
                    this.datasetsAdded.splice(index, 1);
                    return resolve(id);
                });
            }
        });
    }
    performQuery(query) {
        return new Promise((resolve, reject) => {
            this.queryEngine.query(query).then((result) => {
                return resolve(result);
            }).catch((err) => reject(err));
        });
    }
    listDatasets() {
        return new Promise((resolve) => {
            return resolve(this.datasetsToBeListed);
        });
    }
}
exports.default = InsightFacade;
//# sourceMappingURL=InsightFacade.js.map