const fs = require('fs');
const DiscordRPC = require('discord-rpc');
const filepath = process.argv[2] || 'classes.txt';

const clientId = '1197870452966694933';
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

// Initialize the Discord RPC connection
rpc.login({ clientId }).catch(console.error);

let currentClassGlobal = null, showingClass = null;
String.prototype.trimFull = function () { return this.trim().replace(/\s+/g, ' ') }
Date.prototype.getWeekIndex = function () { return Math.ceil((this - new Date(this.getFullYear(), 0, 1)) / 86400000 / 7) }
String.prototype.toCapitalized = function () { return this.charAt(0).toUpperCase() + this.slice(1); }
Array.prototype.sortClasses = function () {
    return this.sort((a, b) => {
        const minPeriodA = Math.min(...a.periods);
        const maxPeriodA = Math.max(...a.periods);
        const minPeriodB = Math.min(...b.periods);
        const maxPeriodB = Math.max(...b.periods);
        
        if (minPeriodA !== minPeriodB) {
            return minPeriodA - minPeriodB;
        } else if (maxPeriodA !== maxPeriodB) {
            return maxPeriodB - maxPeriodA;
        } else if (a.startTime !== b.startTime) {
            return a.startTime - b.startTime;
        } else {
            return b.endTime - a.endTime;
        }
    });
};


var classTimes = [], toIgnore = {};

const daysOfWeek = {
    "sunday": 0,
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6
}

// Function to update the presence
function updatePresence(classInfo) {
    rpc.setActivity({
        details: (((classInfo.name == "Break") || (classInfo.name == "day off")) ? "Having a " : ((classInfo.name == "Before school") || (classInfo.name == "After school")) ? "" : "In ") + classInfo.name + (((classInfo.name == "Break") || (classInfo.name == "day off") || (classInfo.name == "Before school") || (classInfo.name == "After school")) ? "" : " class"),
        state: (classInfo.periods ? (classInfo.periods.length > 0 ? (classInfo.name != "Break" ? (classInfo.periods.length > 0 ? (classInfo.periods.length == 1 ? "Period " + Number(classInfo.periods[0]) : "Periods " + Math.min(...classInfo.periods) + "-" + Math.max(...classInfo.periods)) : "") : "Between periods " + classInfo.periods[0] + " and " + classInfo.periods[1]) : "") : ""),
        startTimestamp: (classInfo.startTime == null || classInfo.endTime == null) ? null : classInfo.startTime,
        endTimestamp: (classInfo.endTime == null || classInfo.startTime == null) ? null : classInfo.endTime,
        largeImageKey: 'YOUR_LARGE_IMAGE_KEY',
        instance: false,
        type: 2
    });
}

// Function to read the classes file and update presence accordingly
function readClassesFile(filePath) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const classes = parseClassesData(data);
        showingClass = currentClassGlobal;
        const currentClass = getCurrentClass(classes);
        if (currentClass == showingClass) {
            return;
        }
        updatePresence(currentClass);
    });
}

// Parse the classes data from the file
function parseClassesData(data) {
    var classes = {
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
    };
    const today = new Date();
    const currentDay = today.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

    const lines = data.split('\n');
    lines.forEach(line => {
        console.log(line)
        if (line.split(" ")[0] == "#" || line.trimFull() == "") {
            return;
        }

        if (line.trimFull().startsWith(".define")) {
            switch (line.trimFull().split(" ")[1]) {
                case "classTime": {
                    if (Number(line.trimFull().split(" ")[2]) != NaN && classTimes.indexOf(line.trimFull().split(" ")[2]) == -1) classTimes[line.trimFull().split(" ")[2]] = [line.trimFull().split(" ")[3], line.trimFull().split(" ")[4]];
                }
            }
            return;
        }

        if (line.trimFull().startsWith(".ignore")) {
            var [date, ...periodsToIgnore] = line.trimFull().split(" ").slice(1);
            var dateParsed = date.split("/").reverse().join("-");
            toIgnore[dateParsed] = periodsToIgnore;
            return;
        }

        const parts = line.trimFull().split('"');
        const name = parts[1];
        const [day, repetition, startTime, endTime] = parts[2].trimFull().split(' ');
        if (!name || !day || !repetition || !startTime || !endTime) return;

        const dayOfWeek = day.toLowerCase();
        const classStartTime = new Date();
        if (Object.keys(daysOfWeek).includes(dayOfWeek)) {classStartTime.setDate(today.getDate() + (currentDay <= daysOfWeek[dayOfWeek] ? daysOfWeek[dayOfWeek] - currentDay : 7 + daysOfWeek[dayOfWeek] - currentDay))} else {classStartTime.setDate(today.getDate())};
        classStartTime.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]), 0);

        const classEndTime = new Date();
        if (Object.keys(daysOfWeek).includes(dayOfWeek)) {classStartTime.setDate(today.getDate() + (currentDay <= daysOfWeek[dayOfWeek] ? daysOfWeek[dayOfWeek] - currentDay : 7 + daysOfWeek[dayOfWeek] - currentDay))} else {classStartTime.setDate(today.getDate())};
        classEndTime.setHours(parseInt(endTime.split(':')[0]), parseInt(endTime.split(':')[1]), 0);

        const periods = [];
        for (let period in classTimes) {try {
            
                var periodStartTime = new Date(classStartTime);
                periodStartTime.setHours(parseInt(classTimes[period][0].split(':')[0]), parseInt(classTimes[period][0].split(':')[1]), 0);
                var periodEndTime = new Date(classStartTime);
                periodEndTime.setHours(parseInt(classTimes[period][1].split(':')[0]), parseInt(classTimes[period][1].split(':')[1]), 0);
                if (classStartTime < periodEndTime && classEndTime > periodStartTime) {
                    periods.push(parseFloat(period));
                }
        } catch (error) {
            console.log(error)
        }
        }

        if (classes[dayOfWeek] == undefined) {
            classes[dayOfWeek] = [];
        }

        classes[dayOfWeek].push({
            name,
            startTime: classStartTime,
            endTime: classEndTime,
            periods: periods,
            repetition: String(repetition),
        });
    })
    return classes;
}

// Get the current class based on current time
function getCurrentClass(classes) {
    const now = new Date();
    const today = now.getFullYear() + "-" + (String(now.getMonth() + 1).padStart(2, '0')) + "-" + (String(now.getDate()).padStart(2, '0'))
    let classNow = null;
    
    if ((classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).length == 0) && (classes[today] == undefined || classes[today].length == 0)) {
        console.log(classes)
        return { name: 'day off', startTime: null, endTime: null };
    }


    classes[Object.keys(daysOfWeek)[new Date().getDay()]].sortClasses().forEach(classInfo => {
        if (now >= classInfo.startTime &&
            now < classInfo.endTime &&
            !(classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period))))) && 
            (classInfo.repetition == 1 || now.getWeekIndex() % classInfo.repetition.split("/")[0] == classInfo.repetition.split("/")[1])
            && classInfo != null)
        { classNow = classInfo;}
    });

    if (classes[today]) classes[today].sortClasses().forEach(classInfo => {
        if (now >= classInfo.startTime &&
            now < classInfo.endTime && 
            (classInfo.repetition == 1 || now.getWeekIndex() % classInfo.repetition.split("/")[0] == classInfo.repetition.split("/")[1]))
        { classNow = classInfo; }
    })
    if (classNow != null) return classNow;

    let breakNow = {
        name: "Break",
        startTime: null,
        endTime: null,
        periods: [],
    }

    if (classes[today] != undefined) {
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).concat(classes[today]).sortClasses().forEach(classInfo => {
            console.log(classInfo)
            if (now >= classInfo.startTime && now >= classInfo.endTime && classInfo.endTime > breakNow.startTime && (classInfo.repetition == 1 || now.getWeekIndex() % classInfo.repetition.split("/")[0] == classInfo.repetition.split("/")[1])) {
                breakNow.startTime = classInfo.endTime;
                breakNow.periods[0] = (Math.max(...(classInfo.periods.map(period => Number(period)))));
            }
        });
    
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).concat(classes[today]).sortClasses().forEach(classInfo => {
            console.log(classInfo)
            if (now < classInfo.startTime && now > breakNow.startTime && breakNow.endTime == null && (classInfo.repetition == 1 || now.getWeekIndex() % classInfo.repetition.split("/")[0] == classInfo.repetition.split("/")[1])) {
                breakNow.endTime = classInfo.startTime;
                breakNow.periods[1] = (Math.min(...(classInfo.periods.map(period => Number(period)))));
            }
        });
    } else {
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).sortClasses().forEach(classInfo => {
            console.log(classInfo)
            if (now >= classInfo.startTime && now >= classInfo.endTime && classInfo.endTime > breakNow.startTime &&(classInfo.repetition == 1 || now.getWeekIndex() % classInfo.repetition.split("/")[0] == classInfo.repetition.split("/")[1])) {
                breakNow.startTime = classInfo.endTime;
                breakNow.periods[0] = (Math.max(...(classInfo.periods.map(period => Number(period)))));
            }
        });
    
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).sortClasses().forEach(classInfo => {
            console.log(classInfo)
            if (now < classInfo.startTime && now > breakNow.startTime && breakNow.endTime == null && (classInfo.repetition == 1 || now.getWeekIndex() % classInfo.repetition.split("/")[0] == classInfo.repetition.split("/")[1])) {
                breakNow.endTime = classInfo.startTime;
                breakNow.periods[1] = (Math.min(...(classInfo.periods.map(period => Number(period)))));
            }
        });
    }
    console.log(breakNow)

    if (breakNow.startTime != null && breakNow.endTime != null && breakNow.periods[0] != undefined && breakNow.periods[1] != undefined) { breakNow.name = "Break"; return breakNow; }
    
    var outOfSchool = null;
    var beforeSchool = [];
    var afterSchool = [];

    if (classes[today] != undefined) {
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).concat(classes[today]).forEach(classInfo => {
            beforeSchool.push(new Date(now) < new Date(classInfo.startTime));
        })
            let schoolStartTime = Math.min(...classes[Object.keys(daysOfWeek)[new Date().getDay()]].concat(classes[today]).map(classInfo => classInfo.startTime));
            if (beforeSchool.every(x => x == true)) outOfSchool = { name: 'Before school', startTime: null, endTime: schoolStartTime };
    } else {
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).forEach(classInfo => {
            beforeSchool.push(new Date(now) < new Date(classInfo.startTime));
        })
        let schoolStartTime = Math.min(...classes[Object.keys(daysOfWeek)[new Date().getDay()]].map(classInfo => classInfo.startTime));
        if (beforeSchool.every(x => x == true)) outOfSchool = { name: 'Before school', startTime: null, endTime: schoolStartTime };
    }

    if (classes[today] != undefined) {
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).concat(classes[today]).forEach(classInfo => {
            afterSchool.push(new Date(now) > new Date(classInfo.endTime));
        })
        let schoolEndTime = Math.max(...classes[Object.keys(daysOfWeek)[new Date().getDay()]].concat(classes[today]).map(classInfo => classInfo.endTime));
        if (afterSchool.every(x => x == true)) outOfSchool = { name: 'After school', startTime: schoolEndTime, endTime: null };
    } else {
        classes[Object.keys(daysOfWeek)[new Date().getDay()]].filter(classInfo => !classInfo.periods.some(period => typeof toIgnore[today] != "undefined" && (toIgnore[today].includes(String(period)) || toIgnore[today].length == 0))).forEach(classInfo => {
            afterSchool.push(new Date(now) > new Date(classInfo.endTime));
        })
        let schoolEndTime = Math.max(...classes[Object.keys(daysOfWeek)[new Date().getDay()]].map(classInfo => classInfo.endTime));
        if (afterSchool.every(x => x == true)) outOfSchool = { name: 'After school', startTime: schoolEndTime, endTime: null };
    }
    console.log(outOfSchool, beforeSchool, afterSchool);
    return outOfSchool;
}

// Periodically check for class updates
setInterval(() => {
    readClassesFile(filepath);
}, 60000); // Check every minute

fs.watchFile(filepath, { interval: 1000 }, () => readClassesFile(filepath));

// Initial read of the classes file
readClassesFile(filepath);
