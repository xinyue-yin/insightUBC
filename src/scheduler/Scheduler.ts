import {IScheduler, SchedRoom, SchedSection, TimeSlot} from "./IScheduler";

export default class Scheduler implements IScheduler {

    private timeSlots: TimeSlot[] =
        ["MWF 0800-0900", "MWF 0900-1000", "MWF 1000-1100",
            "MWF 1100-1200", "MWF 1200-1300", "MWF 1300-1400",
            "MWF 1400-1500", "MWF 1500-1600", "MWF 1600-1700",
            "TR  0800-0930", "TR  0930-1100", "TR  1100-1230",
            "TR  1230-1400", "TR  1400-1530", "TR  1530-1700"];

    public schedule(sections: SchedSection[], rooms: SchedRoom[]): Array<[SchedRoom, SchedSection, TimeSlot]> {
        // TODO Implement this
        let schedule: Array<[SchedRoom, SchedSection, TimeSlot]> = [];
        // sort sections from largest to smallest
        sections.sort((a: SchedSection, b: SchedSection) => {
            return this.numberOfStudents(b) - this.numberOfStudents(a);
        });
        // find the minimum number of students and filter out rooms that cannot fit in
        let minNumOfStudents = this.numberOfStudents(sections[sections.length - 1]);
        rooms = rooms.filter((room) => {
            return room.rooms_seats >= minNumOfStudents;
        });
        // find central location and sort rooms from closest to furthest
        let centralLocation = this.getCenterGeolocation(rooms);
        rooms.sort((a: SchedRoom, b: SchedRoom) => {
            return this.distance(a.rooms_lat, a.rooms_lon, centralLocation.lat, centralLocation.lon)
            - this.distance(b.rooms_lat, b.rooms_lon, centralLocation.lat, centralLocation.lon);
        });
        // loop over timeslots, at most 15 times
        // if (rooms.length * 14 < sections.length) {
        //     for (let i = 0; i < 15; i++) {
        //         if (!sections.length || !rooms.length) {
        //             break;
        //         }
        //         let sectionsForThisTimeSlot: SchedSection[] = JSON.parse(JSON.stringify(sections));
        //         let roomsForThisTimeSlot: SchedRoom[] = JSON.parse(JSON.stringify(rooms));
        //         while (sectionsForThisTimeSlot.length && roomsForThisTimeSlot.length) {
        //             // select the section with largest number of student from available sections
        //             let currentSection: SchedSection = sectionsForThisTimeSlot[0];
        //             let numOfStudents: number = this.numberOfStudents(currentSection);
        //             // find the index of the room that can fit in numOfStudents and is closest to center
        //             let availableRoomIndex: number = this.availableRoomIndex(roomsForThisTimeSlot, numOfStudents);
        //             if (availableRoomIndex !== -1) {
        //                 // if found, add the struct to schedule
        //                 schedule.push([roomsForThisTimeSlot[availableRoomIndex], currentSection, this.timeSlots[i]]);
        //                 // remove the room from the available rooms for current timeslot
        //                 roomsForThisTimeSlot.splice(availableRoomIndex, 1);
        //                 // remove the section from main list of sections
        //                 sections.splice(this.findSectionIndex(sections, currentSection), 1);
        //                 // remove the section and all sections of the same course
        //                 sectionsForThisTimeSlot = sectionsForThisTimeSlot.filter((section) => {
        //                     return section.courses_dept !== currentSection.courses_dept ||
        //                         section.courses_id !== currentSection.courses_id;
        //                 });
        //             } else {
        //                 // if not found, remove the section from available sections for current timeslot
        //                 sectionsForThisTimeSlot.shift();
        //             }
        //         }
        //     }
        // } else {
        schedule = this.lessSections(sections, rooms);
        // }
        return schedule;
    }

    private numberOfStudents(section: SchedSection): number {
        return section.courses_fail + section.courses_pass + section.courses_audit;
    }

    // return the center geolocation given a list of lat, lon points
    // private getCenterGeolocation(rooms: SchedRoom[]) {
    //     if (rooms.length === 1) {
    //         return {lat: rooms[0].rooms_lat, lon: rooms[0].rooms_lon};
    //     }
    //     let x: number = 0;
    //     let y: number = 0;
    //     let z: number = 0;
    //     for (let room of rooms) {
    //         let lat = room.rooms_lat * Math.PI / 180;
    //         let lon = room.rooms_lon * Math.PI / 180;
    //         x += Math.cos(lat) * Math.cos(lon);
    //         y += Math.cos(lat) * Math.sin(lon);
    //         z += Math.sin(lat);
    //     }
    //     let total = rooms.length;
    //     x = x / total;
    //     y = y / total;
    //     z = z / total;
    //     let centralLon = Math.atan2(y, x);
    //     let centralSqrt = Math.sqrt(x * x + y * y);
    //     let centralLat = Math.atan2(z, centralSqrt);
    //
    //     return {lat: centralLat * 180 / Math.PI, lon: centralLon * 180 / Math.PI};
    // }
    private getCenterGeolocation(rooms: SchedRoom[]) {
        let centerlat = 0;
        let centerlon = 0;
        let ep = 300;
        let num = 0;
        for (let room of rooms) {
            let numOfRoomsCloseBy = rooms.filter((r) => {
                return this.distance(r.rooms_lat, r.rooms_lon, room.rooms_lat, room.rooms_lon) < ep;
            }).length;
            if (numOfRoomsCloseBy > num) {
                num = numOfRoomsCloseBy;
                centerlat = room.rooms_lat;
                centerlon = room.rooms_lon;
            }
        }
        return {lat: centerlat, lon: centerlon};
    }


    // return the distance between two geolocations in meters
    private distance(lat1: number, lon1: number, lat2: number, lon2: number): number {

        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // in metres
    }

    // find the first available room that fits in size
    private availableRoomIndex(rooms: SchedRoom[], size: number) {
        return rooms.findIndex((room) => {
            return room.rooms_seats >= size;
        });
    }

    private findSectionIndex(sections: SchedSection[], currentSection: SchedSection) {
        return sections.findIndex((section) => {
            return section.courses_uuid === currentSection.courses_uuid;
        });
    }

    private lessSections(sections: SchedSection[], rooms: SchedRoom[]) {
        let schedule: Array<[SchedRoom, SchedSection, TimeSlot]> = [];
        let timeSlotsRoomsList: any[][] = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], []];
        let timeSlotsSectionsList: any[][] = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], []];
        for (let section of sections) {
            let tSIndex = this.findTimeSlotIndex(timeSlotsSectionsList, section);
            if (tSIndex !== -1) {
                let rIndex = this.findRoomIndex(timeSlotsRoomsList[tSIndex], rooms, section);
                if (rIndex !== -1) {
                    schedule.push([rooms[rIndex], section, this.timeSlots[tSIndex]]);
                    timeSlotsSectionsList[tSIndex].push(section);
                    timeSlotsRoomsList[tSIndex].push(rooms[rIndex]);
                }
            }
        }
        return schedule;
    }

    private findTimeSlotIndex(timeSlotsList: any[][], section: SchedSection) {
        let tsMintoMax = [... Array(15).keys()];
        tsMintoMax.sort((a, b) => {
            return timeSlotsList[a].length - timeSlotsList[b].length;
        });
        for (let i of tsMintoMax) {
            if (timeSlotsList[i].length === 0) {
                return i;
            } else if (timeSlotsList[i].every((element) => {
                return element.courses_id !== section.courses_id ||
                    element.courses_dept !== section.courses_dept;
            })) {
                return i;
            }
        }
        return -1;
    }

    private findRoomIndex(timeSlot: any[], rooms: SchedRoom[], section: SchedSection) {
        let availableRooms;
        if (timeSlot.length === 0) {
            availableRooms = rooms;
        } else {
            availableRooms = rooms.filter((r) => {
                return !timeSlot.includes(r);
            });
        }
        let relativeIndex = this.availableRoomIndex(availableRooms, this.numberOfStudents(section));
        return rooms.indexOf(availableRooms[relativeIndex]);
    }
}
