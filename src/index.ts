import { createServer } from "node:http"
import * as dotenv from 'dotenv';
import createApplication from "./app/app.js";

dotenv.config();

const startServer = () => {
    const server = createServer(createApplication())
    const PORT = process?.env?.PORT;
    server.listen(PORT, () => {
        console.log("Server is running at PORT", PORT)
    })
}

startServer();