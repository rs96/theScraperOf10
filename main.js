const axios = require("axios");
const HTMLParser = require("node-html-parser");
const cheerio = require("cheerio");
const fs = require("fs");
const athleteURL =
    "https://www.thepowerof10.info/athletes/profile.aspx?athleteid=";
const constants = require("./constants");

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

const getData = async () => {
    let cells;
    let athlete;
    let performance;
    const performanceFields = [
        "eventId",
        "performance",
        "tags",
        "wind",
        "something1",
        "position",
        "heat",
        "something2",
        "something3",
        "venueId",
        "meeting",
        "date",
    ];
    let venue;

    for (let athleteId = 78994; athleteId < 78995; athleteId++) {
        try {
            if (athleteId % 10 === 0) {
                console.log(`${athleteId} athletes scraped`);
            }
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
                    if (
                        $(element).html().replace("&amp;", "&") ===
                        $(element).text()
                    ) {
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
            athletes.push(athlete);

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
                // go through each cell in the row and add that to a performance object
                cells.each((i, cell) => {
                    switch (i) {
                        case 0:
                            performance.eventId = parseEventFromString(
                                $(cell).text()
                            );
                            break;
                        case 1:
                            performance.performance =
                                parsePerformanceFromString($(cell).text());
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
                            performance.meetingId = parseMeetingFromLink(
                                $(cell)
                            );
                            performance.meeting = $(cell).text();
                            performance.venueId = parseVenueFromString(
                                $(cell).text(),
                                performance.tags
                            );
                            break;
                        case 11:
                            // we add i as date is used for ids in the app that uses this dataset
                            performance.date =
                                parseDateFromString($(cell).text()) + j;
                            break;
                        case (6, 10):
                            if ($(cell).text()) {
                                performance[performanceFields[i]] =
                                    $(cell).text();
                            }
                            break;
                        default:
                            break;
                    }
                });
                // need to add a check that performance matches the correct format
                performances.push(performance);
            }
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

const parseMeetingFromLink = (cell) => {
    const name = cell.text();
    const id = parseMeetingIdFromLink(cell.html());
    for (i in meetings) {
        if (meetings[i].id === id) {
            return id;
        }
    }
    meetings.push({ id, name });
    return id;
};

const parseMeetingIdFromLink = (link) => {
    return parseInt(link.split("meetingid=")[1].split("&amp;")[0]);
};

const parseWindReading = (windReading) =>
    windReading === "" ? 0 : parseFloat(windReading);

getData();
