const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const athleteURL =
    "https://www.thepowerof10.info/athletes/profile.aspx?athleteid=";

const getPo10AthletePage = async (athleteId) => {
    try {
        const res = await axios({
            url: `${athleteURL}${athleteId}`,
            method: "get",
            timeout: 8000,
            headers: { "Access-Control-Allow-Origin": "*" },
        });
        return res;
    } catch (error) {
        console.log(error);
    }
};

const venues = [];
const events = [];
const athletes = [];
const performances = [];
const meetings = [];

// const performanceFields = [
//     "eventId",
//     "performance",
//     "tags",
//     "wind",
//     "something1",
//     "position",
//     "heat",
//     "something2",
//     "something3",
//     "venueId",
//     "meeting",
//     "date",
// ];

const getData = async () => {
    let cells;
    let athlete;
    let performance;

    for (let athleteId = 78994; athleteId < 78995; athleteId++) {
        try {
            if (athleteId % 10 === 0) {
                console.log(`${athleteId} athletes scraped`);
            }

            const athleteData = await getAthleteData(athleteId);

            // need to add a check that performance matches the correct format
            athletes.push(athleteData.athlete);
            performances.push(...athleteData.performances);
        } catch (error) {
            console.log(error);
        }
    }

    // remove those performances which are "blank" i.e. the

    // write data to file
    writeDataToFile("athletes", athletes);
    writeDataToFile("performances", performances);
    writeDataToFile("venues", venues);
    writeDataToFile("events", events);
};

const writeDataToFile = (file, newData) => {
    fs.readFile(`./data/${file}.json`, (error, existingData) => {
        let data = JSON.parse(existingData);
        data = data.concat(newData);
        fs.writeFile(`./data/${file}.json`, JSON.stringify(data), (error) => {
            if (error) {
                console.log(error);
            }
            console.log("File Written");
        });
    });
};

const getAthleteData = async (athleteId) => {
    let performances = [];
    // get page from website
    const $ = cheerio.load(
        await getPo10AthletePage(athleteId)
            .then((po10page) => po10page.data, "text/html")
            .catch((error) => console.log(error))
    );

    // scrape page for athlete details
    athlete = {};
    const dataList = [];
    $("#cphBody_pnlAthleteDetails")
        .find("td")
        .each((i, element) => {
            if ($(element).html().replace("&amp;", "&") === $(element).text()) {
                dataList.push($(element).text());
            }
        });

    athlete["id"] = athleteId;
    athlete["name"] = $("h2").first().text().trim();

    if (dataList[0] == "Yes") {
        athlete["club"] = dataList[1];
        athlete["sex"] = dataList[2];
        athlete["age_group"] = dataList[3];
        athlete["county"] = dataList[4];
        athlete["region"] = dataList[5];
        athlete["nation"] = dataList[6];
    } else {
        athlete["club"] = dataList[0];
        athlete["sex"] = dataList[1];
        athlete["age_group"] = dataList[2];
        athlete["county"] = dataList[3];
        athlete["region"] = dataList[4];
        athlete["nation"] = dataList[5];
    }

    // scrape page for performances
    let rows = $("#cphBody_pnlPerformances")
        .find(".alternatingrowspanel")
        .first()
        .find("tr");

    // go through each row on the performances table and create a performance object to relate
    // rows.each((i, row) => {
    for (let j = 0; j < 14; j++) {
        const row = rows[j];
        cells = $(row).find("td");
        // skip those rows which are season headings
        if ($(cells[0]).html() !== $(cells[0]).text()) {
            continue;
        }
        performance = {
            athleteId,
            eventId: 0,
            performance: 0,
            tags: "",
            wind: "",
            position: 0,
            heat: "",
            venueId: 0,
            meeting: "",
            date: 0,
        };
        let meetingId;
        // go through each cell in the row and add that to a performance object
        cells.each((i, cell) => {
            switch (i) {
                case 0:
                    performance.eventId = parseEventFromString($(cell).text());
                    break;
                case 1:
                    performance.performance = parsePerformanceFromString(
                        $(cell).text()
                    );
                    break;
                case 2:
                    performance.tags = $(cell).text().split("");
                    break;
                case 3:
                    performance.wind = parseWindReading($(cell).text());
                    break;
                case 5:
                    performance.position = parseInt($(cell).text());
                    break;
                case 9:
                    // get meetingId and venueId from the link in the "Venue" column
                    meetingId = parseMeetingIdFromLink($(cell).html());
                    performance.meetingId = meetingId;
                    performance.venueId = parseVenueFromString(
                        $(cell).text(),
                        performance.tags
                    );
                    break;
                case 11:
                    // we add i as date is used for ids in the app that uses this dataset
                    performance.date = parseDateFromString($(cell).text()) + j;
                    break;
                case 6:
                    if ($(cell).text()) {
                        performance.heat = $(cell).text();
                    }
                    break;
                case 10:
                    performance.meeting = $(cell).text();
                    // if new meeting is added, this is the actual meeting name to add, not the venue id
                    handleMeetingCreation(
                        performance.meetingId,
                        $(cell).text()
                    );
                    break;
                default:
                    break;
            }
        });
        performances.push(performance);
    }
    return { athlete, performances, venues, meetings, events };
};

const parseDateFromString = (value) => {
    const [day, month, year] = value.split(" ");
    const date = new Date(
        `20${year}-${month < 10 ? "0" : ""}${month}-${
            day < 10 ? "0" : ""
        }${day}`
    );
    return date.valueOf();
};

const parsePerformanceFromString = (performance) => {
    let value = 0;
    let splitStrings;
    let rest;
    splitStrings = performance.split(":");
    if (splitStrings.length > 1) {
        value = parseFloat(splitStrings[0]) * 60;
        rest = splitStrings[1];
    } else {
        rest = splitStrings[0];
    }
    const [secs, hundredths] = rest.split(".");
    if (secs) {
        value = value + parseFloat(secs);
    }
    if (hundredths) {
        value = value + parseFloat(hundredths) / 100;
    }
    return value;
};

const parseVenueFromString = (venue, tags) => {
    const isIndoor = tags.includes("i");
    const isAtAtltitude = tags.includes("A");
    const isOversized = tags.includes("+");
    for (i in venues) {
        if (
            venues[i].name === venue &&
            venues[i].isIndoor === isIndoor &&
            venues[i].isOversized === isOversized &&
            venues[i].isAtAltitude === isAtAtltitude
        ) {
            return venues[i].id;
        }
    }
    let newVenueId = venues.length + 1;
    venues.push({
        id: newVenueId,
        name: venue,
        isIndoor: isIndoor,
        isOversized: isOversized,
        isAtAltitude: isAtAtltitude,
    });
    return newVenueId;
};

const parseEventFromString = (event) => {
    for (i in events) {
        if (events[i].name === event) {
            return events[i].id;
        }
    }
    // add new event to list if not existing
    let newEventId = events.length + 1;
    events.push({ id: newEventId, name: event });
    return newEventId;
};

const handleMeetingCreation = (id, name) => {
    if (meetings.find((meeting) => meeting.id === id)) {
        return;
    }
    meetings.push({ id, name });
};

const parseMeetingIdFromLink = (link) =>
    parseInt(link.split("meetingid=")[1].split("&amp;")[0]);

const parseWindReading = (windReading) =>
    windReading === "" ? 0 : parseFloat(windReading);

module.exports = {
    getAthleteData,
};
