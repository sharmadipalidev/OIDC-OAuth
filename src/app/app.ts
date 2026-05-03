import express, { type NextFunction, type Request, type Response, type Application } from "express";
import path from "node:path";
import authRouter from "./module/auth/routes.js"
import { openIdConfig } from "./module/auth/controller.js";
import ApiError from "./common/utils/ApiError.js";

const isInvalidJsonError = (error: unknown) => {
    if (!(error instanceof SyntaxError)) {
        return false;
    }

    return "body" in error;
};

const createApplication = (): Application => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use("/public", express.static(path.resolve(process.cwd(), "public")));

    app.get("/", (_, res) => {
        res.send("Server is running")
    })

    app.get("/.well-known/openid-configuration", openIdConfig);
    app.use("/api/auth", authRouter);

    app.use((error: unknown, _: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            next(error);
            return;
        }

        if (isInvalidJsonError(error)) {
            res.status(400).json({
                message: "Invalid JSON body",
                success: false
            });
            return;
        }

        if (error instanceof ApiError) {
            res.status(error.statusCode).json({
                message: error.message,
                success: false
            });
            return;
        }

        console.error(error);
        res.status(500).json({
            message: "Internal server error",
            success: false
        });
    });

    return app;
}

export default createApplication;
