const fs = require('fs');
const DiscordRPC = require('discord-rpc');
const filepath = process.argv[2] || 'classes.txt';

const clientId = '1197870452966694933';
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

// Initialize the Discord RPC connection
rpc.login({ clientId }).catch(console.error);

let currentClassGlobal = null, showingClass = null;

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
        details: `${classInfo.name == "Break" ? "Has a " : "In"} ${classInfo.name} ${classInfo.name != "Break" ? " class" : ""}`,
        startTimestamp: classInfo.startTime,
        endTimestamp: classInfo.endTime,
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
    const classes = {
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
        const parts = line.trim().split('"');
        const name = parts[1];
        const [day, repetition, startTime, endTime] = parts[2].trim().split(' ');

        const dayOfWeek = day.toLowerCase();
        const classStartTime = new Date();
        classStartTime.setDate(today.getDate() + (currentDay <= daysOfWeek[dayOfWeek] ? daysOfWeek[dayOfWeek] - currentDay : 7 + daysOfWeek[dayOfWeek] - currentDay));
        classStartTime.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]), 0);

        const classEndTime = new Date();
        classEndTime.setDate(today.getDate() + (currentDay <= daysOfWeek[dayOfWeek] ? daysOfWeek[dayOfWeek] - currentDay : 7 + daysOfWeek[dayOfWeek] - currentDay));
        classEndTime.setHours(parseInt(endTime.split(':')[0]), parseInt(endTime.split(':')[1]), 0);
        classes[dayOfWeek].push({
            name,
            startTime: classStartTime,
            endTime: classEndTime,
            repetition: parseInt(repetition),
        });
    });
    return classes;
}

// Get the current class based on current time
function getCurrentClass(classes) {
    const now = new Date();
    let classNow = null;
    classes[Object.keys(daysOfWeek)[new Date().getDay()]].forEach(classInfo => {
        if (now >= classInfo.startTime && now < classInfo.endTime) {
            classNow = classInfo;
        }
    });
    if (classNow != null) return classNow;
    let breakNow = {
        name: "Break",
        startTime: null,
        endTime: null,
    }

    classes[Object.keys(daysOfWeek)[new Date().getDay()]].forEach(classInfo => {
        if (now >= classInfo.startTime && now >= classInfo.endTime) {
            breakNow.startTime = classInfo.endTime;
        }
    });

    classes[Object.keys(daysOfWeek)[new Date().getDay()]].forEach(classInfo => {
        if (now < classInfo.startTime && now > breakNow.startTime) {
            breakNow.endTime = classInfo.startTime;
        }
    });
    return breakNow;
}

// Periodically check for class updates
setInterval(() => {
    readClassesFile(filepath);
}, 60000); // Check every minute

// Initial read of the classes file
readClassesFile(filepath);
