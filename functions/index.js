const functions = require("firebase-functions");
const express = require("express");
const app = express();
const port = 5000;
const cors = require("cors");
const main = require("./main");

app.use(cors());

app.get("/", (req, res) => res.send("Server Root"));

app.get("/athlete/:id", (req, res) => {
  const athleteData = main
      .getAthleteData(req.params.id)
      .then((result) => result)
      .catch((error) => error);
  res.send(athleteData);
});

app.listen(port, () =>
  console.log(`theScraperOf10 is running at http://localhost:${port}`),
);

exports.app = functions.https.onRequest(app);
