import { type Response } from "express";

class ApiResponse {
    constructor(res: Response, statusCode = 200, message: string = "successful", data: any) {
        return res.status(statusCode).json({
            message,
            data,
            success: true
        })
    }
}

export default ApiResponse;