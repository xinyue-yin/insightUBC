import Log from "../Util";
import {InsightDataset, InsightDatasetKind, InsightError} from "./IInsightFacade";
import * as jszip from "jszip";
import { JSZipObject } from "jszip";
import * as fs from "fs";
export class AddRooms {
    // fields
    private dataStructure: any = {};
    private id: string = null;
    private folderContents: any = [];
    private buildingInfos: any[] = [];
    private zip: jszip;
    private parse5 = require("parse5");
    private rowCount: number = 0; // number of row means number of valid rooms
    public listOfBuildings: object[] = [];
    private relativePath: string[] = [];
    constructor() {
        Log.trace("InsightFacadeImpl::init()");
    }

    public addDatasetRooms(id: string, content: string): Promise<InsightDataset> {
        return new Promise<InsightDataset>((resolve, reject) => {
            this.id = id;
            this.dataStructure = {};
            this.folderContents = [];
            this.buildingInfos = [];
            this.rowCount = 0;
            jszip.loadAsync(content, { base64: true }).then((result: jszip) => {
                this.zip = result;
                this.parseRooms().then((dataset) => {
                    resolve(dataset);
                }).catch((err) => {
                    reject(err);
                });
            }).catch(() => {
                return reject(
                    new InsightError(
                        "Incorrect file format that caused error in jszip.",
                    ),
                );
            });
        });
    }

    private parseRooms(): Promise<InsightDataset> {
        return new Promise<InsightDataset>((resolve, reject) => {
            this.parseIndex().then(() => {
                this.zip.folder("rooms").forEach((relativePath: string, file: JSZipObject) => {
                    if (this.relativePath.includes(relativePath)) {
                        this.folderContents.push(file.async("text"));
                    }
                });
                this.parseBuildings().then((insightDataSet) => {
                    resolve(insightDataSet);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    private parseIndex(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            if (this.zip.file("rooms/index.htm") === null) {
                reject(new InsightError("Cannot find index"));
            }
            this.zip.file("rooms/index.htm").async("text").then((file) => {
                this.traverseBuildings(
                    this.parse5.parse(file),
                    this.buildingInfos,
                );
            }).then(() => {
                this.buildingProperties(this.buildingInfos).then(() => {
                    resolve(true);
                }).catch((err) => {
                    reject(err);
                });
            });
        });
    }

    private parseBuildings(): Promise<InsightDataset> {
        return new Promise<InsightDataset>((resolve, reject) => {
            Promise.all(this.folderContents).then((buildings) => {
                let isValidDataset = false;
                let i = 0;
                for (let building of buildings) {
                    let validRooms: number = this.isContainingAtLeastOneRoom(this.parse5.parse(building));
                    if (validRooms > 0) {
                        isValidDataset = true;
                    }
                    i++;
                }
                if (!isValidDataset) {
                    return reject(
                        new InsightError("Datasets in " + this.id + " are invalid."));
                } else {
                    const insightDataset: InsightDataset = {
                        id: this.id,
                        kind: InsightDatasetKind.Rooms,
                        numRows: this.dataStructure["Data"].length,
                    };
                    this.dataStructure["Dataset"] = insightDataset;
                    let isWriteSuccessful = this.writeToDisk(this.id);
                    if (!isWriteSuccessful) {
                        return reject( new InsightError("The Write is unsuccessful"));
                    } else {
                        return resolve(insightDataset);
                    }
                }
            }).catch(() => {
                return reject(new InsightError("Invalid Dataset"));
            });
        });
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

    public traverseBuildings(node: any, result: any[]) {
        if (node.tagName === "td") {
            if (node.attrs[0].value === "views-field views-field-field-building-code" ||
                node.attrs[0].value === "views-field views-field-field-building-address") {
                result.push(node.childNodes[0].value.substring(13, node.childNodes[0].value.length - 10));
            }
            if (node.attrs[0].value === "views-field views-field-title") {
                result.push(node.childNodes[1].attrs[0].value);
                result.push(node.childNodes[1].childNodes[0].value);
            }
        } else {
            if (Object.keys(node).includes("childNodes")) {
                for (let child of node.childNodes) {
                    this.traverseBuildings(child, result);
                }
            }
        }
    }

    public buildingProperties(array: any[]): Promise<boolean> {
        return new Promise((resolve) => {
            const http = require("http");
            let promiseArray: any[] = [];
            for (let i = 0; i < array.length; i += 4) {
                let addressURL: string = encodeURI(array[i + 3]);
                const url = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team152/" + addressURL;
                promiseArray.push(new Promise((fulfill) => {
                        http.get(url, null, (res: any) => {
                            res.setEncoding("utf8");
                            res.on("data", (chunk: any) => {
                                let result = JSON.parse(chunk);
                                fulfill(result);
                            });
                        });
                    }),
                );
            }
            let k = 0;
            Promise.all(promiseArray).then((resultArray: any[]) => {
                for (let result of resultArray) {
                    if (!result.hasOwnProperty("error")) {
                        let building: any = {};
                        building["shortname"] = array[k];
                        building["fullname"] = array[k + 2];
                        building["address"] = array[k + 3];
                        building["lat"] = result["lat"];
                        building["lon"] = result["lon"];
                        this.relativePath.push(
                            array[k + 1].substring(2),
                        );
                        this.listOfBuildings.push(building);
                    }
                    k += 4;
                }
            }).then(() => {
                resolve(true);
            });
        });
    }

    public roomProperties(room: any[], buildingName: any) {
        let i = 0;
        let length = room.length;
        let building: any = this.listOfBuildings.filter((element: any) => {
            return element.shortname === buildingName;
        })[0];
        while (i < length) {
            let roomProperties: any = {};
            roomProperties[this.id + "_fullname"] = building.fullname;
            roomProperties[this.id + "_shortname"] = building.shortname;
            roomProperties[this.id + "_number"] = room[i + 1];
            roomProperties[this.id + "_name"] = roomProperties[this.id + "_shortname"] + "_" +
                roomProperties[this.id + "_number"];
            roomProperties[this.id + "_address"] = building.address;
            roomProperties[this.id + "_lat"] = building.lat;
            roomProperties[this.id + "_lon"] = building.lon;
            roomProperties[this.id + "_href"] = room[i];
            if (parseInt(room[2], 10) !== 0) {
                roomProperties[this.id + "_seats"] = parseInt(room[i + 2], 10);
                roomProperties[this.id + "_type"] = room[i + 4];
                roomProperties[this.id + "_furniture"] = room[i + 3];
                i += 5;
            } else {
                roomProperties[this.id + "_seats"] = 0;
                roomProperties[this.id + "_type"] = room[i + 3];
                roomProperties[this.id + "_furniture"] = room[i + 2];
                i += 4;
            }
            if (this.dataStructure.hasOwnProperty("Data")) {
                this.dataStructure["Data"].push(roomProperties);
            } else {
                this.dataStructure["Data"] = [];
                this.dataStructure["Data"].push(roomProperties);
            }
        }
    }

    public isContainingAtLeastOneRoom(building: any) {
        let roomInfos: any[] = [];
        let name: any = building.childNodes[6].childNodes[1].childNodes[9].attrs[1].value;
        this.traverseRooms(building, roomInfos);
        if (roomInfos.length > 0) {
            this.roomProperties(roomInfos, name);
        }
        return roomInfos.length;
    }

    public traverseRooms(node: any, result: any[]) {
        if (node.tagName === "td") {
            if (node.attrs[0].value === "views-field views-field-field-room-capacity" ||
                node.attrs[0].value === "views-field views-field-field-room-furniture" ||
                node.attrs[0].value === "views-field views-field-field-room-type") {
                result.push(
                    node.childNodes[0].value.substring(
                        13,
                        node.childNodes[0].value.length - 10,
                    ),
                );
            }
            if (node.attrs[0].value === "views-field views-field-field-room-number") {
                result.push(node.childNodes[1].attrs[0].value);
                result.push(node.childNodes[1].childNodes[0].value);
            }
        } else {
            if (Object.keys(node).includes("childNodes")) {
                for (let child of node.childNodes) {
                    this.traverseRooms(child, result);
                }
            }
        }
    }
}
