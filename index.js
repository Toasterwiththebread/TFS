const express = require('express')
const app = express()
const multer = require('multer');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require("uuid");
const splitFile = require("split-file");
const { mkdir, writeFile } = require("fs/promises");
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const path = require("path");
const fetch = require("node-fetch");

app.use(express.json());

const data = []

var cron = require('node-cron');
var fs = require('fs');

require('dotenv').config();

const upload = multer({ dest: __dirname + '/files' });
const client = new MongoClient(process.env.MONGODB_URI);


cron.schedule('*/5 * * * *', () => {
    deleteOldFiles();
});


async function deleteOldFiles() {
    console.log("Running file deletion CRON job");
    const db = client.db("TFS");
    const database_interaction = await db.collection("Files").find({ time_expires: { $lte: Date.now() } }).toArray();
    for (const val of database_interaction) {
        try {
            fs.unlinkSync(__dirname + "/files/" + val.location);
        } catch {
            console.log("Tried deleting file, ran into error, most likely already deleted, ID: " + val.id)
        }
        await db.collection("Files").deleteOne({ id: val.id });
        console.log("Deleted file with ID of: " + val.id);
    }
}


async function Init() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (e) {
        console.error(e);
    }
}

const downloadFile = (async (url, folder = ".") => {
    const res = await fetch(url);
    if (!fs.existsSync("./temporary")) await mkdir("./temporary");
    if (!fs.existsSync("./files")) await mkdir("./files");
    const destination = path.resolve("./temporary", folder);
    const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
    await finished(Readable.from(res.body).pipe(fileStream));
});


Init()


app.get('/', (req, res) => {
    res.status(200).send({ status: "OK" });
})


app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (req.query.key === process.env.KEY) {
            const db = client.db("TFS");
            const id = uuidv4();
            await db.collection("Files").insertOne({ "id": id, "time": Date.now(), "time_expires": Date.now() + 30 * 60000, "location": req.file.filename, "extension": req.file.originalname.split(".").pop(), "original_name": req.file.originalname });
            res.status(200).send({ status: "OK", id: id });
        } else {
            res.status(401).send({ error: "Invalid credentials" });
        }
    } catch {
        res.status(500).send({ error: "Invalid parameters" });
    }
})

app.post('/discord', async (req, res) => {
    try {
        if (req.query.key === process.env.KEY) {
            for (const val of req.body.url) {
                await downloadFile(val, val.substring(val.lastIndexOf('/') + 1))
                data.push("./temporary/" + val.substring(val.lastIndexOf('/') + 1));
            }
            const id = uuidv4()
            splitFile
                .mergeFiles(
                    data,
                    "./files/" + id
                )
                .then(() => {
                    try {
                        for (const val of data) {
                            fs.unlinkSync(val);
                        }
                    } catch (e) {
                        console.log(e)
                        console.log("Failed to delete temporary file")
                    }
                })
                .catch((err) => {
                    console.log("Error: ", err);
                });
            const db = client.db("TFS");
            await db.collection("Files").insertOne({ "id": id, "time": Date.now(), "time_expires": Date.now() + 30 * 60000, "location": id, "extension": req.body.name.split(".").pop(), "original_name": req.body.name });
            res.status(200).send({ status: "OK", id: id });
        } else {
            res.status(401).send({ error: "Invalid credentials" });
        }
    } catch (e) {
        console.log(e)
        res.status(500).send({ error: "Invalid parameters" });
    }
})


app.get("/download", async (req, res) => {
    try {
        const db = client.db("TFS");
        const database_interaction = await db.collection("Files").findOne({ id: req.query.id });
        res.status(200).download(__dirname + "/files/" + database_interaction.location, database_interaction.original_name);
    } catch {
        res.status(500).send({ error: "Invalid parameters" });
    }
})


app.listen(5000, () => {
    console.log(`TFS listening on port 5000`);
})
