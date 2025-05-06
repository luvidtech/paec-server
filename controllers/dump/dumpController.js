import asyncHandler from "../../utils/asyncHandler.js"
import { exec } from "child_process"
import fs from "fs"
import archiver from "archiver"
import path from "path"
import { fileURLToPath } from "url"
import User from "../../models/userModel.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const generateDump = asyncHandler(async (req, res, next) => {
    const uploadsDir = path.join(__dirname, "../../uploads")
    const dumpDir = path.join(uploadsDir, "db-dump")
    const ghdDir = path.join(dumpDir, "ghd")

    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
    if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir)

    const now = new Date()
    const timestamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 16)
    const zipFileName = `ghd-dump-${timestamp}.zip`
    const zipFilePath = path.join(uploadsDir, zipFileName)

    const mongoDumpPath = process.env.MONGO_DUMP_PATH || "mongodump"
    const mongoUri = process.env.MONGO_URI

    const dumpCommand = `"${mongoDumpPath}" --uri="${mongoUri}" --out="${dumpDir}"`

    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            console.error("Dump error:", stderr)
            return res.status(500).json({
                message: "Failed to create database dump",
                error: stderr,
            })
        }

        console.log("mongodump complete, starting zip...")

        const output = fs.createWriteStream(zipFilePath)
        const archive = archiver("zip", { zlib: { level: 9 } })

        output.on("close", () => {
            console.log(`ZIP created: ${zipFileName} (${archive.pointer()} bytes)`)

            // Delete ghd folder
            fs.rm(ghdDir, { recursive: true, force: true }, (err) => {
                if (err) console.error("Error deleting ghd folder:", err)
                else console.log("ghd folder deleted successfully")

                res.json({
                    message: "Database dumped, zipped, and cleaned up",
                    zipPath: `/uploads/${zipFileName}`,
                })

                // Cleanup: Retain only latest 3 ZIPs
                fs.readdir(uploadsDir, (err, files) => {
                    if (err) return console.error("Failed to read uploads dir:", err)

                    const zipFiles = files
                        .filter(file => file.startsWith("ghd-dump-") && file.endsWith(".zip"))
                        .map(file => ({
                            name: file,
                            time: fs.statSync(path.join(uploadsDir, file)).mtime.getTime()
                        }))
                        .sort((a, b) => b.time - a.time) // newest first

                    const oldZips = zipFiles.slice(3)
                    for (const file of oldZips) {
                        const filePath = path.join(uploadsDir, file.name)
                        fs.unlink(filePath, err => {
                            if (err) console.error(`Error deleting old ZIP ${file.name}:`, err)
                            else console.log(`Old ZIP deleted: ${file.name}`)
                        })
                    }
                })
            })
        })

        archive.on("error", (err) => {
            console.error("Archive error:", err)
            return res.status(500).json({
                message: "Failed to zip ghd folder",
                error: err.message,
            })
        })

        archive.pipe(output)
        archive.directory(ghdDir, "ghd")
        archive.finalize()
    })
})


export const getDump = asyncHandler(async (req, res) => {

    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized ", 403))
    }

    const uploadsDir = path.join(__dirname, "../../uploads")

    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read upload directory" })

        const zipFiles = files
            .filter(file => file.startsWith("ghd-dump-") && file.endsWith(".zip"))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(uploadsDir, file)).mtime.getTime(),
                url: `/api/dumps/download/${file}`
            }))
            .sort((a, b) => b.time - a.time)
            .slice(0, 3)

        res.json(zipFiles)
    })
})


export const downloadDump = asyncHandler(async (req, res, next) => {
    const isAdmin = await User.findOne({ _id: req.user._id, role: "admin", 'isDeleted.status': false })

    if (!isAdmin) {
        return next(new HttpError("You are not authorized", 403))
    }

    const fileName = req.params.file
    const filePath = path.join(__dirname, "../../uploads", fileName)

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" })
    }

    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error(err)
            return res.status(500).json({ message: "Failed to download file" })
        }
    })
})
