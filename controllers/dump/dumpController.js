import asyncHandler from "../../utils/asyncHandler.js"
import { exec } from "child_process"
import fs from "fs"
import archiver from "archiver"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const generateDump = asyncHandler(async (req, res, next) => {
    const uploadsDir = path.join(__dirname, "../../uploads") // Adjusted for new location
    const dumpDir = path.join(uploadsDir, "db-dump")
    const ghdDir = path.join(dumpDir, "ghd")

    // Create necessary directories
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)
    if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir)

    // Generate timestamped filename
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 16)
    const zipFileName = `ghd-dump-${timestamp}.zip`
    const zipFilePath = path.join(uploadsDir, zipFileName)

    const dumpCommand = `"C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongodump.exe" --uri="mongodb://127.0.0.1:27017/ghd" --out="${dumpDir}"`

    // Step 1: Run mongodump
    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            console.error("Dump error:", stderr)
            return res.status(500).json({
                message: "Failed to create database dump",
                error: stderr,
            })
        }

        console.log("mongodump complete, starting zip...")

        // Step 2: Create ZIP after dump
        const output = fs.createWriteStream(zipFilePath)
        const archive = archiver("zip", { zlib: { level: 9 } })

        output.on("close", () => {
            console.log(`ZIP created: ${zipFileName} (${archive.pointer()} bytes)`)

            // Step 3: Delete the ghd folder after successful zipping
            fs.rm(ghdDir, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.error("Error deleting ghd folder:", err)
                } else {
                    console.log("ghd folder deleted successfully")
                }

                res.json({
                    message: "Database dumped, zipped, and cleaned up",
                    zipPath: `/uploads/${zipFileName}`, // public-facing path
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
        archive.directory(ghdDir, "ghd") // Add the entire ghd folder
        archive.finalize()
    })
})
