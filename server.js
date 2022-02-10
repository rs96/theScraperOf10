const express = require("express");
const app = express();
const port = 5000;
const cors = require("cors");

app.use(cors());

app.get("/", (req, res) => res.send("Server Root"));

app.get("/athlete/:id", (req, res) => {});

app.listen(port, () =>
    console.log(`Tracked server is running at http://localhost:${port}`)
);
