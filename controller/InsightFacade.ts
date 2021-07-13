import Log from "../Util";
import {
    IInsightFacade,
    InsightDataset,
    InsightDatasetKind,
    InsightError,
    NotFoundError,
} from "./IInsightFacade";
import * as jszip from "jszip";
import {JSZipObject} from "jszip";
import * as fs from "fs";
import {QueryEngine} from "./QueryEngine";
import {AddRooms} from "./AddRooms";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
    // fields
    private datasetsAdded: string[] = [];
    private dataStructure: any = {};
    private datasetsToBeListed: InsightDataset[] = [];
    private courseProperties: { [index: string]: string };
    private queryEngine: QueryEngine = new QueryEngine();
    private addRooms: AddRooms = new AddRooms();

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        /* List of what this need to do:
         * check if id is valid (format, redundancy, and can it be found)
         * check zip format
         * unpack zip
         * parse JSON
         * check for validity of dataset (at least one course section) with correct format
         * save the content to a data structure of my design (that can be saved/loaded?)
         * keep track of number of rows
         */
        return new Promise<string[]>((resolve, reject) => {
            let dataset;
            if (!InsightFacade.isIDValid(id)) {
                // checking validity of id
                return reject(new InsightError("The id is not valid."));
            } else if (this.addedBefore(id)) {
                // checking redundancy
                return reject(
                    new InsightError("This dataset/id have been added before."),
                );
            } else if (kind === InsightDatasetKind.Rooms) {
                dataset = this.addRooms.addDatasetRooms(id, content);

            } else if (kind === InsightDatasetKind.Courses) {
                dataset = this.addDatasetCourses(id, content, kind);
            }
            dataset.then((insightDataset: any) => {
                this.datasetsAdded.push(id);
                this.datasetsToBeListed.push(insightDataset);
                return resolve(this.datasetsAdded);
            }).catch((err: any) => {
                return reject(err);
            });
        });
    }

    private addDatasetCourses(id: string, content: string, kind: InsightDatasetKind): Promise<InsightDataset> {
        return new Promise((resolve, reject) => {
            let folderContents: any = [];
            let validCourses: any[] = [];
            let rowCount: number = 0; // number of row means number of valid sections
            jszip.loadAsync(content, {base64: true}).then((result: jszip) => {
                result.folder("courses").forEach((relativePath: string, file: JSZipObject) => {
                    folderContents.push(file.async("text"));
                });
                // parse JSON for each file
                Promise.all(folderContents).then((results) => {
                    let parsedFile: any;
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
                        let validSections: number = this.isContainingAtLeastOneSection(course);
                        if (validSections > 0) {
                            isValidDataset = true;
                            rowCount += validSections;
                        }
                    }
                    if (!isValidDataset) {
                        return reject(new InsightError("Datasets in " + id + " are invalid."));
                    } else {
                        const insightDataset: InsightDataset = {id: id, kind: kind, numRows: rowCount};
                        this.dataStructure["Dataset"] = insightDataset;
                        let isWriteSuccessful = this.writeToDisk(id);
                        if (isWriteSuccessful) {
                            return resolve(insightDataset);
                        } else {
                            return reject(new InsightError("The Write is unsuccessful"));
                        }
                    }
                });
            })
                .catch(() => {
                    return reject(new InsightError("Incorrect file format that caused error in jszip."));
                });
        });
    }

    private initializeCoursesProperties(id: string): void {
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

    // EFFECT: take a id string and return true if the id follows the format in addDataset's spec
    private static isIDValid(id: string): boolean {
        return !(
            id === undefined ||
            id === null ||
            id.includes("_") ||
            id.trim().length === 0
        );
    }

    // EFFECT: take a id string and check if it is in the datasetAdded, return true if the id and file exist
    private addedBefore(id: string): boolean {
        const path = __dirname + "/../../data/" + id + ".json";
        if (this.datasetsAdded.some((idString: string) => idString === id)) {
            try {
                fs.accessSync(path);
                return true; // file had been added to disk
            } catch (error) {
                // file had not been added to disk
                return false;
            }
        }
    }

    // EFFECT: return the number of valid sections if the json contains at least one valid section,
    //         then add them to a data structure defined by me
    private isContainingAtLeastOneSection(json: any): number {
        let result: any;
        let validSectionCount: number = 0;
        if (!json.hasOwnProperty("result")) {
            return 0;
        } else {
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

    // EFFECT: return true if the section contains the required keys specified in courseProperties
    private isSectionValid(section: any): boolean {
        for (let key of Object.keys(this.courseProperties)) {
            if (!section.hasOwnProperty(this.courseProperties[key])) {
                return false;
            }
        }
        return true;
    }

    // REQUIRE: the section is in valid json format
    // EFFECT: take a section in valid json format and store in the field dataStructure
    private addSectionToDataStructure(section: any): void {
        const data: string = "Data";
        let thisSection: any = {};
        if (section.Section === "overall") {
            section.Year = 1900;
        } else {
            section.Year = parseInt(section.Year, 10);
        }
        section.id = section.id.toString();
        if (this.dataStructure.hasOwnProperty(data)) {
            for (let key of Object.keys(this.courseProperties)) {
                thisSection[key] = section[this.courseProperties[key]];
            }
            this.dataStructure[data].push(thisSection);
        } else {
            this.dataStructure[data] = [];
            for (let key of Object.keys(this.courseProperties)) {
                thisSection[key] = section[this.courseProperties[key]];
            }
            this.dataStructure[data].push(thisSection);
        }
    }

    // EFFECT: take a input and return a valid json if input is in the right format,
    //         otherwise return null
    private static parseJSON(input: any): any {
        let output: any;
        try {
            output = JSON.parse(input);
        } catch (error) {
            return null;
        }
        return output;
    }

    // EFFECT: write the dataStructure to the disk and give the file name of id,
    //         then empty the dataStructure field, return true if success, else false.
    private writeToDisk(id: string): boolean {
        const path: string = __dirname + "/../../data/" + id + ".json";
        const data: any = JSON.stringify(this.dataStructure);
        try {
            fs.writeFileSync(path, data);
            this.dataStructure = {};
            return true;
        } catch (error) {
            return false;
        }
    }

    public removeDataset(id: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (!InsightFacade.isIDValid(id)) {
                return reject(new InsightError("The id is not valid."));
            }
            if (!this.addedBefore(id)) {
                return reject(new NotFoundError("The dataset haven't been added before"));
            } else {
                fs.unlink(
                    __dirname + "/../../data/" + id + ".json",
                    (error) => {
                        if (error !== null) {
                            return reject(
                                new InsightError("Dataset: " + id + " could not be removed"));
                        }
                        const index = this.datasetsAdded.indexOf(id);
                        if (index === -1) {
                            return reject(
                                new NotFoundError(
                                    "Conflict between the results of indexOf and addedBefore",
                                ),
                            );
                        }
                        this.datasetsAdded.splice(index, 1);
                        return resolve(id);
                    },
                );
            }
        });
    }

    public performQuery(query: any): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.queryEngine.query(query).then((result) => {
                return resolve(result);
            }).catch((err) => reject(err));
        });
    }

    /**
     * List all currently added datasets, their types, and number of rows.
     *
     * @return Promise <InsightDataset[]>
     * The promise should fulfill an array of currently added InsightDatasets, and will only fulfill.
     */
    public listDatasets(): Promise<InsightDataset[]> {
        return new Promise<InsightDataset[]>((resolve) => {
            return resolve(this.datasetsToBeListed);
        });
    }
}
