const express = require("express");
const cheerio = require('cheerio');
const fs = require("fs");
const app = express();


// list all files in the public folder
app.get("/", function (req, res) {
    fs.readdir(__dirname + "/public", function (err, files) {
        res.json({
            directory: "public",
            files: files,
            error: err?.message
        });
    });
});

// flush the public folder
app.get("/flush", function (req, res) {
    fs.rmSync(__dirname + "/public", { recursive: true, force: true });
    fs.mkdirSync(__dirname + "/public");
    res.send("Flushed");
});

// serve the video file
app.get("/video/:file", function (req, res) {
    // Ensure there is a range given for the video
    const range = req.headers.range;
    if (!range) {
        return res.status(400).send("Requires Range Header");
    }

    const videoPath = "./public/" + req.params.file;
    const videoSize = fs.statSync(videoPath).size;

    const CHUNK_SIZE = 10 ** 6; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=600",
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);

    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start, end });

    // Stream the video chunk to the client
    videoStream.pipe(res);
});

// send the player html file
app.get("/view/:file", function (req, res) {
    // check if the file exists
    const file = req.params.file;

    if (!fs.existsSync("./public/" + file)) {
        return res.status(404).send(`File ${file || "undefined"} not found`);
    }

    // read the file
    fs.readFile("./html/view.html", function (err, data) {
        if (err) {
            res.status(500).send(err.message);
        } else {
            const $ = cheerio.load(data);
            // update the 'src' attributes of source tag to point to the video
            $("source").each(function (i, el) {
                $(el).attr("src", `/video/${file}`);
            });
            res.send($.html());
        }
    }
    );
})

// serve the other static files requred to play video
app.get("/assets/:file", function (req, res) {
    // check if the file exists
    const file = req.params.file;

    if (!fs.existsSync("./public/" + file)) {
        return res.status(404).send(`File ${file || "undefined"} not found`);
    }

    res.setHeader("Cache-Control", "public, max-age=6");
    res.sendFile(__dirname + "/public/" + file);
})


app.listen(8000, function () {
    console.log("Listening on port 8000!");
});
