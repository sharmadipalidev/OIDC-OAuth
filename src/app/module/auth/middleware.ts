import { type NextFunction, type Request, type Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import ApiError from "../../common/utils/ApiError.js";

export type AccessTokenPayload = JwtPayload & {
    id: number
    email?: string
    name?: string
}

export interface AuthenticatedRequest extends Request {
    user?: AccessTokenPayload
}

const publicKeyPath = path.resolve(process.cwd(), "cert", "public.pem");

const getPublicKey = () => {
    // Step 1: Try to read the public key file from disk.
    // Step 2: Return the key content as utf8 when successful.
    // Step 3: If reading fails, throw a 500 ApiError.
    try {
        return fs.readFileSync(publicKeyPath, "utf8");
    } catch {
        throw new ApiError(500, "Public key is not defined");
    }
}

const getBearerToken = (authorizationHeader?: string) => {
    // Step 1: Ensure the Authorization header exists and starts with "Bearer ".
    // Step 2: If the format is invalid, return null.
    // Step 3: Strip the "Bearer " prefix.
    // Step 4: Trim the remaining token and return it.
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice(7).trim();
}

export const verifyAccessToken = (
    req: AuthenticatedRequest,
    _: Response,
    next: NextFunction
) => {
    // Step 1: Read the bearer token from the Authorization header.
    // Step 2: If no token is provided, throw a 401 ApiError.
    // Step 3: Verify the token using the RS256 algorithm and public key.
    // Step 4: Ensure the decoded payload is an object and contains a numeric user id.
    // Step 5: If payload shape is invalid, throw a 401 ApiError.
    // Step 6: Attach the decoded payload to req.user.
    // Step 7: Call next() to continue to the protected route handler.
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
        throw new ApiError(401, "Access token required");
    }

    const decodedToken = jwt.verify(token, getPublicKey(), {
        algorithms: ["RS256"]
    });

    if (typeof decodedToken === "string" || typeof decodedToken.id !== "number") {
        throw new ApiError(401, "Invalid access token");
    }

    req.user = decodedToken as AccessTokenPayload;
    next();
}
